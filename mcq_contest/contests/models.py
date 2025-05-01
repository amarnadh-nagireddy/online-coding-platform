from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.postgres.fields import ArrayField
from django.core.exceptions import ValidationError
from django.utils import timezone
import json

User = get_user_model()

def validate_positive(value):
    if value <= 0:
        raise ValidationError(f"{value} must be positive.")

class Contest(models.Model):
    name = models.CharField(max_length=255)
    start_datetime = models.DateTimeField()
    end_datetime = models.DateTimeField()
    duration_minutes = models.IntegerField(validators=[validate_positive])
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['start_datetime']

    def __str__(self):
        return self.name

    def clean(self):
        if self.end_datetime <= self.start_datetime:
            raise ValidationError("End date must be after start date.")
        if self.start_datetime < timezone.now() and self.pk is None:
            raise ValidationError("Start date cannot be in the past for new contests.")

class Question(models.Model):
    QUESTION_TYPES = (
        ('mcq', 'Multiple Choice'),
        ('msq', 'Multiple Select'),
        ('blank', 'Fill in the Blank'),
        ('coding', 'Coding'),
    )

    contest = models.ForeignKey(Contest, related_name='questions', on_delete=models.CASCADE)
    question_type = models.CharField(max_length=10, choices=QUESTION_TYPES)
    description = models.TextField()
    options = ArrayField(models.CharField(max_length=255), blank=True, null=True)
    answer = models.JSONField(blank=True, null=True)
    score = models.IntegerField(default=1, validators=[validate_positive])
    visible_test_cases = models.JSONField(blank=True, null=True)
    invisible_test_cases = models.JSONField(blank=True, null=True)
    time_limit_seconds = models.IntegerField(default=1, validators=[validate_positive], blank=True, null=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"{self.question_type.upper()}: {self.description[:50]}"

    def clean(self):
        if self.question_type in ['mcq', 'msq']:
            if not self.options or len(self.options) < 2:
                raise ValidationError("MCQ/MSQ must have at least 2 options.")
            if not all(opt.strip() for opt in self.options):
                raise ValidationError("All options must be non-empty.")
            if self.answer is None:
                raise ValidationError("MCQ/MSQ questions must have an answer.")
            if self.question_type == 'mcq':
                answer_value = self.answer
                if isinstance(answer_value, list):
                    if len(answer_value) != 1:
                        raise ValidationError("MCQ answer must be a single option or a single-item list.")
                    answer_value = answer_value[0]
                if not isinstance(answer_value, str) or answer_value not in self.options:
                    raise ValidationError("MCQ answer must be a single option from the options list.")
            elif self.question_type == 'msq':
                if not isinstance(self.answer, list) or not all(ans in self.options for ans in self.answer) or not self.answer:
                    raise ValidationError("MSQ answer must be a non-empty list of options from the options list.")
        elif self.question_type == 'blank':
            if self.answer is None or not isinstance(self.answer, str):
                raise ValidationError("Blank questions must have a string answer.")
        elif self.question_type == 'coding':
            if self.answer is not None:
                raise ValidationError("Coding questions must have null answer.")
            if not self.visible_test_cases and not self.invisible_test_cases:
                raise ValidationError("Coding questions must have at least one visible or invisible test case.")
            for test_cases in [self.visible_test_cases, self.invisible_test_cases]:
                if test_cases:
                    if not isinstance(test_cases, list) or not all(
                        isinstance(tc, dict) and 'input' in tc and 'output' in tc for tc in test_cases
                    ):
                        raise ValidationError("Test cases must be a list of {'input': str, 'output': str}.")
            if self.time_limit_seconds is None:
                raise ValidationError("Coding questions must have a time limit.")
        if self.question_type != 'coding' and (self.visible_test_cases or self.invisible_test_cases):
            raise ValidationError("Test cases are only for coding questions.")

class Attempt(models.Model):
    contest = models.ForeignKey(Contest, related_name='attempts', on_delete=models.CASCADE)
    student = models.ForeignKey(User, related_name='attempts', on_delete=models.CASCADE)
    score = models.IntegerField(default=0)
    submitted_at = models.DateTimeField(auto_now_add=True)
    answers = models.JSONField()
    test_case_results = models.JSONField(null=True, blank=True)
    is_final = models.BooleanField(default=False)
    back_attempts = models.IntegerField(default=0)
    fullscreen_attempts = models.IntegerField(default=0)

    class Meta:
        unique_together = ('contest', 'student', 'is_final')
        ordering = ['-submitted_at']

    def __str__(self):
        return f"{self.student.username} - {self.contest.name} - {self.score}"

    def clean(self):
        if self.student.role != 'student':
            raise ValidationError("Only students can attempt contests.")