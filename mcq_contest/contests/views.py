from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.utils import timezone
from django.core.exceptions import ValidationError
from datetime import datetime
from django.db import transaction
import pytz
import subprocess
import tempfile
import os
from .models import Contest, Question, Attempt
from django.contrib.auth import get_user_model
import logging

User = get_user_model()
logger = logging.getLogger(__name__)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_dashboard(request):
    user = request.user
    if user.role != 'student':
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    tz = pytz.timezone('Asia/Kolkata')
    now = timezone.now().astimezone(tz)
    contests = Contest.objects.filter(
        is_active=True,
        start_datetime__lte=now,
        end_datetime__gte=now
    )

    contest_list = []
    for contest in contests:
        attempt = Attempt.objects.filter(contest=contest, student=user).first()
        contest_list.append({
            'contest_id': contest.id,
            'name': contest.name,
            'start_datetime': contest.start_datetime.astimezone(tz).strftime('%Y-%m-%dT%H:%M'),
            'end_datetime': contest.end_datetime.astimezone(tz).strftime('%Y-%m-%dT%H:%M'),
            'status': 'Ongoing' if not attempt else 'Attempted',
            'is_active': contest.is_active
        })
    return Response({'contests': contest_list}, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def attempt_contest(request, contest_id):
    """Fetch contest details for a student to attempt."""
    user = request.user
    if user.role != 'student':
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    try:
        contest = Contest.objects.get(id=contest_id)
    except Contest.DoesNotExist:
        return Response({'error': 'Contest not found'}, status=status.HTTP_404_NOT_FOUND)

    tz = pytz.timezone('Asia/Kolkata')
    now = timezone.now().astimezone(tz)

    if not contest.is_active:
        return Response({'error': 'Contest is not active'}, status=status.HTTP_400_BAD_REQUEST)
    if now < contest.start_datetime or now > contest.end_datetime:
        return Response({'error': 'Contest is not within its active period'}, status=status.HTTP_400_BAD_REQUEST)

    # Check if student has an ongoing attempt
    attempt = Attempt.objects.filter(contest=contest, student=user, is_final=False).first()
    if not attempt:
        # Create a new attempt to mark start time
        attempt = Attempt(
            contest=contest,
            student=user,
            score=0,
            answers={},
            is_final=False
        )
        attempt.save()

    # Calculate time remaining based on attempt start time
    time_elapsed = (now - attempt.submitted_at).total_seconds()
    time_remaining = max(0, contest.duration_minutes * 60 - int(time_elapsed))
    # Ensure time doesn't exceed contest end_datetime
    time_to_end = (contest.end_datetime - now).total_seconds()
    time_remaining = min(time_remaining, max(0, time_to_end))

    questions = contest.questions.all()
    question_data = [
        {
            'id': q.id,
            'description': q.description,
            'type': q.question_type,
            'options': q.options,
            'visible_test_cases': q.visible_test_cases,
            'score': q.score,
            'time_limit_seconds': q.time_limit_seconds,
            'initial_code': ''
        }
        for q in questions
    ]

    return Response({
        'id': contest.id,
        'name': contest.name,
        'duration_minutes': contest.duration_minutes,
        'time_remaining': time_remaining,
        'questions': question_data
    }, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_contest(request, contest_id):
    """Handle contest submission, evaluate answers, and calculate score."""
    user = request.user
    if user.role != 'student':
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    try:
        contest = Contest.objects.get(id=contest_id)
    except Contest.DoesNotExist:
        return Response({'error': 'Contest not found'}, status=status.HTTP_404_NOT_FOUND)

    if not contest.is_active:
        return Response({'error': 'Contest is not active'}, status=status.HTTP_400_BAD_REQUEST)

    tz = pytz.timezone('Asia/Kolkata')
    now = timezone.now().astimezone(tz)
    if now < contest.start_datetime or now > contest.end_datetime:
        return Response({'error': 'Contest is not within its active period'}, status=status.HTTP_400_BAD_REQUEST)

    data = request.data
    submission = data.get('submission', [])
    back_attempts = data.get('back_attempts', 0)
    fullscreen_attempts = data.get('fullscreen_attempts', 0)

    if not isinstance(submission, list):
        return Response({'error': 'Submission must be a list'}, status=status.HTTP_400_BAD_REQUEST)

    # Evaluate submission
    total_score = 0
    test_case_results = []
    answers_dict = {}
    questions = contest.questions.all()
    question_dict = {str(q.id): q for q in questions}

    with transaction.atomic():
        for sub in submission:
            question_id = str(sub.get('question_id'))
            submitted_answer = sub.get('answer')

            if question_id not in question_dict:
                logger.error(f"Invalid question ID: {question_id}")
                return Response(
                    {'error': f'Invalid question ID: {question_id}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            question = question_dict[question_id]
            is_correct = False
            result = {
                'question_id': question_id,
                'type': question.question_type,
                'submitted_answer': submitted_answer,
                'correct_answer': question.answer,
                'passed': False,
                'score': 0,
            }

            try:
                if question.question_type in ['mcq', 'blank']:
                    # Normalize answers
                    correct_answer = question.answer[0] if isinstance(question.answer, list) else question.answer
                    submitted_answer = submitted_answer[0] if isinstance(submitted_answer, list) and len(submitted_answer) == 1 else submitted_answer
                    is_correct = str(submitted_answer).strip() == str(correct_answer).strip()
                elif question.question_type == 'msq':
                    submitted_set = set(submitted_answer) if isinstance(submitted_answer, list) else set()
                    correct_set = set(question.answer) if isinstance(question.answer, list) else set([question.answer])
                    is_correct = submitted_set == correct_set
                elif question.question_type == 'coding':
                    all_test_cases = (question.visible_test_cases or []) + (question.invisible_test_cases or [])
                    if not all_test_cases:
                        result['error'] = 'No test cases available'
                    else:
                        code = submitted_answer or ''
                        test_results = evaluate_coding_question(
                            code=code,
                            language=data.get('language', 'python'),
                            test_cases=all_test_cases,
                            time_limit=question.time_limit_seconds or 1
                        )
                        result['test_results'] = test_results
                        is_correct = all(tr['passed'] for tr in test_results)
            except Exception as e:
                logger.error(f"Error evaluating question {question_id}: {str(e)}")
                result['error'] = str(e)

            if is_correct:
                total_score += question.score
                result['passed'] = True
                result['score'] = question.score

            test_case_results.append(result)
            answers_dict[question_id] = submitted_answer

        # Check for existing final attempt
        existing_attempt = Attempt.objects.filter(contest=contest, student=user, is_final=True).first()
        if existing_attempt:
            existing_attempt.delete()  # Allow overwriting final attempt

        # Save attempt
        try:
            attempt = Attempt(
                student=user,
                contest=contest,
                score=total_score,
                answers=answers_dict,
                test_case_results=test_case_results,
                is_final=True,
                back_attempts=back_attempts,
                fullscreen_attempts=fullscreen_attempts
            )
            attempt.full_clean()
            attempt.save()
        except ValidationError as e:
            logger.error(f"ValidationError saving attempt: {str(e)}")
            return Response({'error': f'Failed to save attempt: {str(e)}'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Error saving attempt: {str(e)}")
            return Response({'error': f'Failed to save attempt: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response(
        {
            'message': 'Contest submitted successfully',
            'score': total_score,
            'max_score': sum(q.score for q in questions),
            'test_case_results': test_case_results
        },
        status=status.HTTP_200_OK
    )

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_scores(request):
    """Retrieve a student's attempt history."""
    user = request.user
    if user.role != 'student':
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    attempts = Attempt.objects.filter(student=user, is_final=True)
    attempt_list = []
    tz = pytz.timezone('Asia/Kolkata')
    for attempt in attempts:
        attempt_list.append({
            'contest_id': attempt.contest.id,
            'contest_name': attempt.contest.name,
            'score': attempt.score,
            'max_score': sum(q.score for q in attempt.contest.questions.all()),
            'submitted_at': attempt.submitted_at.astimezone(tz).isoformat(),
            'test_case_results': attempt.test_case_results
        })
    return Response({'attempts': attempt_list}, status=status.HTTP_200_OK)

def evaluate_coding_question(code, language, test_cases, time_limit=1):
    """Evaluate code against test cases, return pass/fail results."""
    results = []
    temp_dir = tempfile.mkdtemp()
    try:
        if language == 'python':
            file_ext = '.py'
            cmd = ['python', '{file}']
        elif language == 'cpp':
            file_ext = '.cpp'
            output_file = os.path.join(temp_dir, 'a.out')
            compile_cmd = ['g++', '{file}', '-o', output_file]
            cmd = [output_file]
        elif language == 'java':
            file_ext = '.java'
            class_name = 'Solution'
            compile_cmd = ['javac', '{file}']
            cmd = ['java', '-cp', temp_dir, class_name]
        elif language == 'c':
            file_ext = '.c'
            output_file = os.path.join(temp_dir, 'a.out')
            compile_cmd = ['gcc', '{file}', '-o', output_file]
            cmd = [output_file]
        else:
            return [{
                'input': None,
                'output': None,
                'expected_output': None,
                'passed': False,
                'error': f'Unsupported language: {language}'
            }]

        source_file = os.path.join(temp_dir, f'solution{file_ext}')
        with open(source_file, 'w') as f:
            f.write(code)

        if language in ['cpp', 'c', 'java']:
            compile_cmd = [arg.format(file=source_file) for arg in compile_cmd]
            compile_result = subprocess.run(
                compile_cmd,
                capture_output=True,
                text=True,
                timeout=10
            )
            if compile_result.returncode != 0:
                return [{
                    'input': None,
                    'output': None,
                    'expected_output': None,
                    'passed': False,
                    'error': f'Compilation failed: {compile_result.stderr}'
                }]

        for test_case in test_cases:
            try:
                cmd_exec = [arg.format(file=source_file) for arg in cmd]
                process = subprocess.run(
                    cmd_exec,
                    input=test_case['input'],
                    text=True,
                    capture_output=True,
                    timeout=time_limit
                )
                output = process.stdout.strip()
                expected = test_case['output'].strip()
                results.append({
                    'input': test_case['input'],
                    'output': output,
                    'expected_output': expected,
                    'passed': output == expected,
                    'error': None
                })
            except subprocess.TimeoutExpired:
                results.append({
                    'input': test_case['input'],
                    'output': None,
                    'expected_output': test_case['output'],
                    'passed': False,
                    'error': 'Time limit exceeded'
                })
            except subprocess.SubprocessError as e:
                results.append({
                    'input': test_case['input'],
                    'output': None,
                    'expected_output': test_case['output'],
                    'passed': False,
                    'error': str(e)
                })

        return results
    finally:
        for root, _, files in os.walk(temp_dir):
            for file in files:
                os.remove(os.path.join(root, file))
        os.rmdir(temp_dir)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def admin_dashboard(request):
    user = request.user
    if user.role != 'admin':
        logger.info(f"Unauthorized access by user {user.username} with role {user.role}")
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    tz = pytz.timezone('Asia/Kolkata')
    now = timezone.now().astimezone(tz)
    contests = Contest.objects.all()

    contest_list = []
    for contest in contests:
        participant_count = Attempt.objects.filter(contest=contest).values('student').distinct().count()
        status_str = (
            'Upcoming' if now < contest.start_datetime else
            'Ongoing' if now <= contest.end_datetime else
            'Completed'
        )
        contest_list.append({
            'contest_id': contest.id,
            'name': contest.name,
            'start_datetime': contest.start_datetime.astimezone(tz).strftime('%Y-%m-%dT%H:%M'),
            'end_datetime': contest.end_datetime.astimezone(tz).strftime('%Y-%m-%dT%H:%M'),
            'max_score': sum(q.score for q in contest.questions.all()),
            'status': status_str,
            'participant_count': participant_count
        })
    return Response({'contests': contest_list}, status=status.HTTP_200_OK)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_contest(request):
    user = request.user
    logger.info(f"Create contest request by user {user.username} with role {user.role}")
    if user.role != 'admin':
        logger.info(f"Unauthorized access by user {user.username} with role {user.role}")
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    tz = pytz.timezone('Asia/Kolkata')
    now = timezone.now().astimezone(tz)

    try:
        start_dt = tz.localize(datetime.strptime(data['start_datetime'], '%Y-%m-%dT%H:%M'))
        end_dt = tz.localize(datetime.strptime(data['end_datetime'], '%Y-%m-%dT%H:%M'))
        duration_minutes = int(data.get('duration_minutes', 60))

        contest = Contest(
            name=data['name'],
            start_datetime=start_dt,
            end_datetime=end_dt,
            duration_minutes=duration_minutes
        )
        contest.full_clean()

        question_data = []
        for idx, q in enumerate(data.get('questions', [])):
            logger.info(f"Processing question {idx + 1}: {q}")
            if q['type'] not in [choice[0] for choice in Question.QUESTION_TYPES]:
                raise ValidationError(f"Question {idx + 1}: Invalid question type '{q['type']}'")

            answer = q.get('answer')
            if q['type'] in ['mcq', 'msq', 'blank']:
                if answer is None:
                    raise ValidationError(f"Question {idx + 1} ({q['type']}): Answer is required.")
                if q['type'] == 'mcq':
                    if isinstance(answer, list):
                        if len(answer) != 1:
                            raise ValidationError(f"Question {idx + 1} (mcq): Answer must be a single option, got {answer}")
                        answer = answer[0]
                    if not isinstance(answer, str) or not answer:
                        raise ValidationError(f"Question {idx + 1} (mcq): Answer must be a non-empty string, got {answer}")
                elif q['type'] == 'msq':
                    if not isinstance(answer, list) or not answer:
                        raise ValidationError(f"Question {idx + 1} (msq): Answer must be a non-empty list, got {answer}")
                elif q['type'] == 'blank':
                    if isinstance(answer, list):
                        if len(answer) != 1:
                            raise ValidationError(f"Question {idx + 1} (blank): Answer must be a single value, got {answer}")
                        answer = answer[0]
                    if not isinstance(answer, str) or not answer:
                        raise ValidationError(f"Question {idx + 1} (blank): Answer must be a non-empty string, got {answer}")
            elif q['type'] == 'coding':
                if answer is not None:
                    raise ValidationError(f"Question {idx + 1} (coding): Answer must be null, got {answer}")
                visible_test_cases = q.get('visible_test_cases', [])
                invisible_test_cases = q.get('invisible_test_cases', [])
                if not (visible_test_cases or invisible_test_cases):
                    raise ValidationError(f"Question {idx + 1} (coding): Must have at least one visible or invisible test case.")
                if not q.get('time_limit_seconds') or q['time_limit_seconds'] <= 0:
                    raise ValidationError(f"Question {idx + 1} (coding): Must have a positive time limit.")

            question_data.append({
                'question_type': q['type'],
                'description': q['description'],
                'options': q.get('options'),
                'answer': answer,
                'score': q.get('score', 1),
                'visible_test_cases': q.get('visible_test_cases') if q['type'] == 'coding' else None,
                'invisible_test_cases': q.get('invisible_test_cases') if q['type'] == 'coding' else None,
                'time_limit_seconds': q.get('time_limit_seconds') if q['type'] == 'coding' else None
            })

        with transaction.atomic():
            contest.save()
            questions = []
            for q_data in question_data:
                question = Question(
                    contest=contest,
                    question_type=q_data['question_type'],
                    description=q_data['description'],
                    options=q_data['options'],
                    answer=q_data['answer'],
                    score=q_data['score'],
                    visible_test_cases=q_data['visible_test_cases'],
                    invisible_test_cases=q_data['invisible_test_cases'],
                    time_limit_seconds=q_data['time_limit_seconds']
                )
                question.full_clean()
                questions.append(question)
            
            for question in questions:
                question.save()

        return Response({'message': 'Contest created', 'contest_id': contest.id}, status=status.HTTP_201_CREATED)

    except KeyError as e:
        logger.error(f"KeyError: Missing field {str(e)}")
        return Response({'error': f"Missing required field: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
    except ValueError as e:
        logger.error(f"ValueError: {str(e)}")
        return Response({'error': f"Invalid data format: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
    except ValidationError as e:
        logger.error(f"ValidationError: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def run_code(request):
    """Run code against provided test cases and return output or error."""
    data = request.data
    code = data.get('code')
    language = data.get('language')
    test_cases = data.get('test_cases', [])
    time_limit = data.get('time_limit', 1)

    if not code or not language:
        return Response(
            {'error': 'Code and language are required'},
            status=status.HTTP_400_BAD_REQUEST
        )

    results = []
    temp_dir = tempfile.mkdtemp()
    try:
        if language == 'python':
            file_ext = '.py'
            cmd = ['python', '{file}']
        elif language == 'cpp':
            file_ext = '.cpp'
            output_file = os.path.join(temp_dir, 'a.out')
            compile_cmd = ['g++', '{file}', '-o', output_file]
            cmd = [output_file]
        elif language == 'java':
            file_ext = '.java'
            class_name = 'Solution'
            compile_cmd = ['javac', '{file}']
            cmd = ['java', '-cp', temp_dir, class_name]
        elif language == 'c':
            file_ext = '.c'
            output_file = os.path.join(temp_dir, 'a.out')
            compile_cmd = ['gcc', '{file}', '-o', output_file]
            cmd = [output_file]
        else:
            return Response(
                {'error': 'Unsupported language'},
                status=status.HTTP_400_BAD_REQUEST
            )

        source_file = os.path.join(temp_dir, f'solution{file_ext}')
        with open(source_file, 'w') as f:
            f.write(code)

        if language in ['cpp', 'c', 'java']:
            compile_cmd = [arg.format(file=source_file) for arg in compile_cmd]
            compile_result = subprocess.run(
                compile_cmd,
                capture_output=True,
                text=True,
                timeout=10
            )
            if compile_result.returncode != 0:
                return Response(
                    {'error': 'Compilation failed', 'details': compile_result.stderr},
                    status=status.HTTP_400_BAD_REQUEST
                )

        for test_case in test_cases:
            try:
                cmd_exec = [arg.format(file=source_file) for arg in cmd]
                process = subprocess.run(
                    cmd_exec,
                    input=test_case.get('input', ''),
                    text=True,
                    capture_output=True,
                    timeout=time_limit
                )
                output = process.stdout.strip()
                error = process.stderr.strip() if process.stderr else None
                results.append({
                    'input': test_case.get('input'),
                    'output': output,
                    'expected_output': test_case.get('output'),
                    'passed': output == test_case.get('output', '').strip(),
                    'error': error
                })
            except subprocess.TimeoutExpired:
                results.append({
                    'input': test_case.get('input'),
                    'output': None,
                    'expected_output': test_case.get('output'),
                    'passed': False,
                    'error': 'Time limit exceeded'
                })
            except subprocess.SubprocessError as e:
                results.append({
                    'input': test_case.get('input'),
                    'output': None,
                    'expected_output': test_case.get('output'),
                    'passed': False,
                    'error': str(e)
                })

        return Response({'results': results}, status=status.HTTP_200_OK)
    finally:
        for root, _, files in os.walk(temp_dir):
            for file in files:
                os.remove(os.path.join(root, file))
        os.rmdir(temp_dir)

@api_view(['PUT'])
@permission_classes([IsAuthenticated])
def edit_contest(request, contest_id):
    user = request.user
    logger.info(f"Edit contest request by user {user.username} with role {user.role}")
    if user.role != 'admin':
        logger.info(f"Unauthorized access by user {user.username} with role {user.role}")
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    try:
        contest = Contest.objects.get(id=contest_id)
    except Contest.DoesNotExist:
        return Response({'error': 'Contest not found'}, status=status.HTTP_404_NOT_FOUND)

    data = request.data
    tz = pytz.timezone('Asia/Kolkata')
    now = timezone.now().astimezone(tz)

    try:
        if data['name'] != contest.name:
            raise ValidationError("Contest name cannot be changed.")
        submitted_start_dt = tz.localize(datetime.strptime(data['start_datetime'], '%Y-%m-%dT%H:%M'))
        if submitted_start_dt != contest.start_datetime:
            raise ValidationError("Contest start datetime cannot be changed.")

        contest.end_datetime = tz.localize(datetime.strptime(data['end_datetime'], '%Y-%m-%dT%H:%M'))
        contest.duration_minutes = int(data.get('duration_minutes', 60))
        contest.full_clean()

        question_data = []
        for idx, q in enumerate(data.get('questions', [])):
            logger.info(f"Processing question {idx + 1}: {q}")
            if q['type'] not in [choice[0] for choice in Question.QUESTION_TYPES]:
                raise ValidationError(f"Question {idx + 1}: Invalid question type '{q['type']}'")

            answer = q.get('answer')
            if q['type'] in ['mcq', 'msq', 'blank']:
                if answer is None:
                    raise ValidationError(f"Question {idx + 1} ({q['type']}): Answer is required.")
                if q['type'] == 'mcq':
                    if isinstance(answer, list):
                        if len(answer) != 1:
                            raise ValidationError(f"Question {idx + 1} (mcq): Answer must be a single option, got {answer}")
                        answer = answer[0]
                    if not isinstance(answer, str) or not answer:
                        raise ValidationError(f"Question {idx + 1} (mcq): Answer must be a non-empty string, got {answer}")
                    options = q.get('options', [])
                    if not options or answer not in options:
                        raise ValidationError(f"Question {idx + 1} (mcq): Answer '{answer}' must be one of the options: {options}")
                elif q['type'] == 'msq':
                    if not isinstance(answer, list) or not answer:
                        raise ValidationError(f"Question {idx + 1} (msq): Answer must be a non-empty list, got {answer}")
                    options = q.get('options', [])
                    if not options or not all(ans in options for ans in answer):
                        raise ValidationError(f"Question {idx + 1} (msq): Answers {answer} must be a subset of options: {options}")
                elif q['type'] == 'blank':
                    if isinstance(answer, list):
                        if len(answer) != 1:
                            raise ValidationError(f"Question {idx + 1} (blank): Answer must be a single value, got {answer}")
                        answer = answer[0]
                    if not isinstance(answer, str) or not answer:
                        raise ValidationError(f"Question {idx + 1} (blank): Answer must be a non-empty string, got {answer}")
            elif q['type'] == 'coding':
                if answer is not None:
                    raise ValidationError(f"Question {idx + 1} (coding): Answer must be null, got {answer}")
                visible_test_cases = q.get('visible_test_cases', [])
                invisible_test_cases = q.get('invisible_test_cases', [])
                if not (visible_test_cases or invisible_test_cases):
                    raise ValidationError(f"Question {idx + 1} (coding): Must have at least one visible or invisible test case.")
                if not q.get('time_limit_seconds') or q['time_limit_seconds'] <= 0:
                    raise ValidationError(f"Question {idx + 1} (coding): Must have a positive time limit.")

            question_data.append({
                'question_type': q['type'],
                'description': q['description'],
                'options': q.get('options'),
                'answer': answer,
                'score': q.get('score', 1),
                'visible_test_cases': q.get('visible_test_cases') if q['type'] == 'coding' else None,
                'invisible_test_cases': q.get('invisible_test_cases') if q['type'] == 'coding' else None,
                'time_limit_seconds': q.get('time_limit_seconds') if q['type'] == 'coding' else None
            })

        with transaction.atomic():
            contest.save()
            questions = []
            for q_data in question_data:
                question = Question(
                    contest=contest,
                    question_type=q_data['question_type'],
                    description=q_data['description'],
                    options=q_data['options'],
                    answer=q_data['answer'],
                    score=q_data['score'],
                    visible_test_cases=q_data['visible_test_cases'],
                    invisible_test_cases=q_data['invisible_test_cases'],
                    time_limit_seconds=q_data['time_limit_seconds']
                )
                question.full_clean()
                questions.append(question)
            
            for question in questions:
                question.save()

        return Response({'message': 'Contest updated successfully'}, status=status.HTTP_200_OK)

    except KeyError as e:
        logger.error(f"KeyError: Missing field {str(e)}")
        return Response({'error': f"Missing required field: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
    except ValueError as e:
        logger.error(f"ValueError: {str(e)}")
        return Response({'error': f"Invalid data format: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)
    except ValidationError as e:
        logger.error(f"ValidationError: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_contest(request, contest_id):
    user = request.user
    logger.info(f"Delete contest request by user {user.username} with role {user.role}")
    if user.role != 'admin':
        logger.info(f"Unauthorized access by user {user.username} with role {user.role}")
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    try:
        contest = Contest.objects.get(id=contest_id)
        contest.delete()
        return Response({'message': 'Contest deleted'}, status=status.HTTP_200_OK)
    except Contest.DoesNotExist:
        return Response({'error': 'Contest not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def view_contest(request, contest_id):
    user = request.user
    logger.info(f"View contest request by user {user.username} with role {user.role}")
    if user.role != 'admin':
        logger.info(f"Unauthorized access by user {user.username} with role {user.role}")
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    try:
        contest = Contest.objects.get(id=contest_id)
        tz = pytz.timezone('Asia/Kolkata')
        questions = contest.questions.all()
        contest_data = {
            'contest_id': contest.id,
            'name': contest.name,
            'start_datetime': contest.start_datetime.astimezone(tz).strftime('%Y-%m-%dT%H:%M'),
            'end_datetime': contest.end_datetime.astimezone(tz).strftime('%Y-%m-%dT%H:%M'),
            'duration_minutes': contest.duration_minutes,
            'is_active': contest.is_active,
            'questions': [
                {
                    'id': q.id,
                    'type': q.question_type,
                    'description': q.description,
                    'options': q.options,
                    'answer': q.answer if q.question_type != 'coding' else None,
                    'score': q.score,
                    'visible_test_cases': q.visible_test_cases,
                    'invisible_test_cases': q.invisible_test_cases,
                    'time_limit_seconds': q.time_limit_seconds
                } for q in questions
            ],
            'max_score': sum(q.score for q in questions)
        }
        return Response(contest_data, status=status.HTTP_200_OK)
    except Contest.DoesNotExist:
        return Response({'error': 'Contest not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def contest_leaderboard(request, contest_id):
    user = request.user
    logger.info(f"Leaderboard request by user {user.username} with role {user.role}")
    if user.role != 'admin':
        logger.info(f"Unauthorized access by user {user.username} with role {user.role}")
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    try:
        contest = Contest.objects.get(id=contest_id)
        attempts = contest.attempts.filter(is_final=True).order_by('-score')
        tz = pytz.timezone('Asia/Kolkata')
        leaderboard = [
            {
                'student_name': attempt.student.username,
                'score': attempt.score,
                'submitted_at': attempt.submitted_at.astimezone(tz).isoformat(),
                'test_case_results': attempt.test_case_results
            } for attempt in attempts
        ]
        contest_data = {
            'contest_id': contest.id,
            'name': contest.name,
            'max_score': sum(q.score for q in contest.questions.all()),
            'participant_count': len(leaderboard)
        }
        return Response({'contest': contest_data, 'leaderboard': leaderboard}, status=status.HTTP_200_OK)
    except Contest.DoesNotExist:
        return Response({'error': 'Contest not found'}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def finalize_contest(request, contest_id):
    user = request.user
    logger.info(f"Finalize contest request by user {user.username} with role {user.role}")
    if user.role != 'admin':
        logger.info(f"Unauthorized access by user {user.username} with role {user.role}")
        return Response({'error': 'Unauthorized'}, status=status.HTTP_403_FORBIDDEN)

    try:
        contest = Contest.objects.get(id=contest_id)
    except Contest.DoesNotExist:
        return Response({'error': 'Contest not found'}, status=status.HTTP_404_NOT_FOUND)

    tz = pytz.timezone('Asia/Kolkata')
    now = timezone.now().astimezone(tz)
    if now < contest.end_datetime:
        return Response({'error': 'Contest is still ongoing'}, status=status.HTTP_400_BAD_REQUEST)

    students = User.objects.filter(attempts__contest=contest).distinct()
    max_score = sum(q.score for q in contest.questions.all())

    for student in students:
        attempts = Attempt.objects.filter(contest=contest, student=student, is_final=False)
        if attempts.exists():
            highest_attempt = attempts.order_by('-score').first()
            highest_attempt.is_final = True
            highest_attempt.test_case_results['objective_score'] = max_score
            highest_attempt.save()
            attempts.exclude(id=highest_attempt.id).delete()

    contest.is_active = False
    contest.save()

    return Response({'message': 'Contest finalized successfully'}, status=status.HTTP_200_OK)