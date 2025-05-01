import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import Navbar from '@/components/Navbar';
import axios from 'axios';
import DateTimePicker from 'react-datetime-picker';
import 'react-datetime-picker/dist/DateTimePicker.css';
import moment from 'moment-timezone';
import { useAuth } from '@/contexts/AuthContext';

const EditContest = () => {
  const { contestId } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const [formData, setFormData] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated || !user || user.role?.toLowerCase() !== 'admin') {
      navigate('/admin/login', { replace: true });
      return;
    }

    const fetchContest = async () => {
      try {
        const token = localStorage.getItem('access_token');
        const response = await axios.get(`http://localhost:8000/api/contests/admin/contest/view/${contestId}/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const startDt = moment.tz(response.data.start_datetime, 'Asia/Kolkata').toDate();
        const endDt = moment.tz(response.data.end_datetime, 'Asia/Kolkata').toDate();
        const questions = response.data.questions.map(q => ({
          id: q.id,
          type: q.question_type,
          description: q.description || '',
          options: Array.isArray(q.options) ? q.options : [],
          answer: q.question_type === 'coding' ? null : JSON.stringify(q.answer || []),
          score: q.score || 1,
          test_cases: q.question_type === 'coding' ? [
            ...(q.visible_test_cases || []).map(tc => ({ input: tc.input || '', output: tc.output || '', visible: true })),
            ...(q.invisible_test_cases || []).map(tc => ({ input: tc.input || '', output: tc.output || '', visible: false })),
          ] : [],
          input_files: [],
          output_files: [],
          question_category: ['mcq', 'msq', 'blank'].includes(q.question_type) ? 'objective' : 'coding',
          time_limit_seconds: q.time_limit_seconds || 1,
        }));
        console.log('Fetched questions:', questions);
        setFormData({
          name: response.data.name || '',
          start_datetime: startDt,
          end_datetime: endDt,
          duration_minutes: response.data.duration_minutes || 60,
          questions,
        });
      } catch (error) {
        console.error('Failed to fetch contest:', error.response?.data || error.message);
        setError('Failed to load contest data. Please try again.');
      }
    };
    fetchContest();
  }, [contestId, authLoading, isAuthenticated, user, navigate]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDateChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
  };

  const openQuestionPanel = (type) => {
    if (type === 'objective') {
      setCurrentQuestion({
        type: 'mcq',
        description: '',
        options: [''],
        answer: [],
        score: 1,
        question_category: 'objective',
      });
    } else if (type === 'coding') {
      setCurrentQuestion({
        type: 'coding',
        description: '',
        test_cases: [],
        input_files: [],
        output_files: [],
        score: 1,
        question_category: 'coding',
        time_limit_seconds: 1,
      });
    }
    setIsPanelOpen(true);
  };

  const closeQuestionPanel = () => {
    setIsPanelOpen(false);
    setCurrentQuestion(null);
  };

  const saveQuestion = () => {
    const questionToSave = { ...currentQuestion };

    if (currentQuestion.question_category === 'objective') {
      if (!currentQuestion.description) {
        setError('Question description is required.');
        return;
      }
      if (currentQuestion.score <= 0) {
        setError('Score must be positive.');
        return;
      }
      if (currentQuestion.type === 'mcq' || currentQuestion.type === 'msq') {
        if (!currentQuestion.options || currentQuestion.options.length < 2 || currentQuestion.options.some(opt => !opt)) {
          setError(`${currentQuestion.type.toUpperCase()} must have at least 2 non-empty options.`);
          return;
        }
      }
      if (currentQuestion.type === 'msq') {
        const answer = currentQuestion.answer || [];
        if (!answer.length) {
          setError('MSQ question must have at least one correct answer.');
          return;
        }
        if (answer.some(ans => !currentQuestion.options.includes(ans))) {
          setError('MSQ answers must be valid options.');
          return;
        }
        questionToSave.answer = JSON.stringify(answer);
      } else if (currentQuestion.type === 'mcq' || currentQuestion.type === 'blank') {
        const answerValue = Array.isArray(currentQuestion.answer) ? currentQuestion.answer[0] : currentQuestion.answer;
        if (!answerValue || typeof answerValue !== 'string') {
          setError(`${currentQuestion.type.toUpperCase()} answer must be a non-empty string.`);
          return;
        }
        if (currentQuestion.type === 'mcq' && !currentQuestion.options.includes(answerValue)) {
          setError(`MCQ answer "${answerValue}" is not in the options list.`);
          return;
        }
        questionToSave.answer = JSON.stringify([answerValue]);
      }
    } else {
      if (!currentQuestion.description) {
        setError('Question description is required.');
        return;
      }
      if (!currentQuestion.test_cases || currentQuestion.test_cases.length < 2) {
        setError('Coding question must have at least two test cases.');
        return;
      }
      if (currentQuestion.test_cases.some(tc => !tc.input || !tc.output)) {
        setError('All test cases must have non-empty input and output.');
        return;
      }
      if (currentQuestion.input_files.length !== currentQuestion.output_files.length || currentQuestion.input_files.length < 2) {
        setError('Coding question must have at least two matching input/output files.');
        return;
      }
      if (!currentQuestion.time_limit_seconds || currentQuestion.time_limit_seconds <= 0) {
        setError('Coding question must have a positive time limit.');
        return;
      }
      const visibleCount = currentQuestion.test_cases.filter(tc => tc.visible).length;
      if (visibleCount === 0 || visibleCount === currentQuestion.test_cases.length) {
        setError('Coding question must have at least one visible and one invisible test case.');
        return;
      }
      questionToSave.answer = null;
    }

    const updatedQuestions = [...formData.questions, questionToSave];
    console.log('Saving question:', questionToSave);
    console.log('Updated questions:', updatedQuestions);
    setFormData({ ...formData, questions: updatedQuestions });
    closeQuestionPanel();
  };

  const handleQuestionChange = (field, value) => {
    setCurrentQuestion({ ...currentQuestion, [field]: value });
  };

  const handleOptionChange = (optIndex, value) => {
    const updatedOptions = [...currentQuestion.options];
    updatedOptions[optIndex] = value;
    if (currentQuestion.type === 'msq' || currentQuestion.type === 'mcq') {
      const currentAnswer = new Set(currentQuestion.answer || []);
      const validAnswer = Array.from(currentAnswer).filter(ans => updatedOptions.includes(ans));
      setCurrentQuestion({
        ...currentQuestion,
        options: updatedOptions,
        answer: validAnswer,
      });
    } else {
      setCurrentQuestion({ ...currentQuestion, options: updatedOptions });
    }
  };

  const addOption = () => {
    setCurrentQuestion({
      ...currentQuestion,
      options: [...currentQuestion.options, ''],
    });
  };

  const removeOption = (optIndex) => {
    const updatedOptions = currentQuestion.options.filter((_, i) => i !== optIndex);
    const currentAnswer = new Set(currentQuestion.answer || []);
    currentAnswer.delete(currentQuestion.options[optIndex]);
    setCurrentQuestion({
      ...currentQuestion,
      options: updatedOptions,
      answer: Array.from(currentAnswer),
    });
  };

  const handleTestCaseVisibility = (tcIndex, checked) => {
    const updatedTestCases = [...currentQuestion.test_cases];
    if (updatedTestCases.length < 2) {
      setError('Coding questions must have at least two test cases to set visibility.');
      return;
    }
    updatedTestCases[tcIndex].visible = checked;
    const visibleCount = updatedTestCases.filter(tc => tc.visible).length;
    if (visibleCount === 0) {
      setError('At least one test case must be visible.');
      updatedTestCases[tcIndex].visible = true;
      return;
    }
    if (visibleCount === updatedTestCases.length) {
      setError('At least one test case must be invisible.');
      updatedTestCases[tcIndex].visible = false;
      return;
    }
    setCurrentQuestion({ ...currentQuestion, test_cases: updatedTestCases });
  };

  const handleFileUpload = (fileType, files) => {
    const fileArray = Array.from(files).map(file => ({
      name: file.name,
      content: null,
    }));
    const readPromises = fileArray.map((file, index) => {
      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
          resolve({ name: file.name, content: e.target.result });
        };
        reader.readAsText(files[index]);
      });
    });
    Promise.all(readPromises).then(loadedFiles => {
      const updatedQuestion = { ...currentQuestion, [fileType]: loadedFiles };
      const inputCount = updatedQuestion.input_files.length;
      const outputCount = updatedQuestion.output_files.length;
      const testCaseCount = Math.min(inputCount, outputCount);
      const updatedTestCases = Array.from({ length: testCaseCount }, (_, i) => ({
        input: updatedQuestion.input_files[i]?.content || '',
        output: updatedQuestion.output_files[i]?.content || '',
        visible: currentQuestion.test_cases[i]?.visible ?? (i === 0),
      }));
      setCurrentQuestion({
        ...updatedQuestion,
        test_cases: updatedTestCases,
      });
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const token = localStorage.getItem('access_token');
    if (!token) {
      setError('Please log in to update the contest.');
      navigate('/admin/login');
      return;
    }

    // Validate new questions to match backend rules
    const invalidQuestion = formData.questions
      .filter(q => !q.id) // Validate only new questions
      .find((q, i) => {
        if (!q.description) return `Question ${i + 1}: Description is required`;
        if (q.score <= 0) return `Question ${i + 1}: Score must be positive`;
        if (q.question_category === 'objective') {
          let answer;
          try {
            answer = q.answer ? JSON.parse(q.answer) : [];
          } catch (e) {
            return `Question ${i + 1}: Invalid answer format`;
          }
          if (['mcq', 'msq', 'blank'].includes(q.type) && !answer.length) {
            return `Question ${i + 1}: At least one answer is required`;
          }
          if (['mcq', 'msq'].includes(q.type)) {
            if (!q.options || q.options.length < 2 || q.options.some(opt => !opt)) {
              return `Question ${i + 1}: MCQ/MSQ must have at least 2 non-empty options`;
            }
            if (q.type === 'mcq' && answer.length > 1) {
              return `Question ${i + 1}: MCQ can only have one correct answer`;
            }
            if (answer.some(ans => !q.options.includes(ans))) {
              return `Question ${i + 1}: Answers must be valid options`;
            }
          }
          if (q.type === 'blank' && answer.length > 1) {
            return `Question ${i + 1}: Blank question can only have one correct answer`;
          }
        } else if (q.question_category === 'coding') {
          if (q.answer !== null) {
            return `Question ${i + 1}: Coding question answer must be null`;
          }
          if (!q.test_cases || q.test_cases.length < 2) {
            return `Question ${i + 1}: Coding question must have at least two test cases`;
          }
          if (q.test_cases.some(tc => !tc.input || !tc.output)) {
            return `Question ${i + 1}: All test cases must have non-empty input and output`;
          }
          if (q.input_files.length !== q.output_files.length || q.input_files.length < 2) {
            return `Question ${i + 1}: Coding question must have at least two matching input/output files`;
          }
          if (!q.time_limit_seconds || q.time_limit_seconds <= 0) {
            return `Question ${i + 1}: Coding question must have a positive time limit`;
          }
          const visibleCount = q.test_cases.filter(tc => tc.visible).length;
          if (visibleCount === 0) {
            return `Question ${i + 1}: Coding question must have at least one visible test case`;
          }
        }
        return null;
      });

    if (invalidQuestion) {
      setError(invalidQuestion);
      return;
    }

    // Construct payload matching backend expectations
    const formattedData = {
      name: formData.name,
      start_datetime: moment(formData.start_datetime).tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm'),
      end_datetime: moment(formData.end_datetime).tz('Asia/Kolkata').format('YYYY-MM-DDTHH:mm'),
      duration_minutes: parseInt(formData.duration_minutes),
      questions: formData.questions
        .filter(q => !q.id) // Send only new questions
        .map(q => ({
          type: q.type,
          description: q.description,
          options: q.options || null,
          answer: q.question_category === 'objective' ? JSON.parse(q.answer || '[]') : null,
          score: q.score,
          visible_test_cases: q.test_cases?.filter(tc => tc.visible).map(tc => ({ input: tc.input, output: tc.output })) || [],
          invisible_test_cases: q.test_cases?.filter(tc => !tc.visible).map(tc => ({ input: tc.input, output: tc.output })) || [],
          time_limit_seconds: q.time_limit_seconds || null,
        })),
    };

    console.log('Submitting contest data:', JSON.stringify(formattedData, null, 2));

    try {
      const response = await axios.put(
        `http://localhost:8000/api/contests/admin/contest/edit/${contestId}/`,
        formattedData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      console.log('API response:', response.data);
      setError('');
      alert(response.data.message || 'Contest updated successfully!');
      navigate('/admin/dashboard');
    } catch (error) {
      console.error('Failed to update contest:', error.response?.data || error.message);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.detail ||
        (typeof error.response?.data === 'object' ? JSON.stringify(error.response.data) : error.message) ||
        'An unexpected error occurred.';
      setError(`Failed to update contest: ${errorMessage}`);
    }
  };

  if (authLoading || !formData) return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 relative">
      <Navbar />
      <div className="container mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold mb-8">Extend Contest</h1>
        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-md">
          <div>
            <Label htmlFor="name">Contest Name</Label>
            <Input id="name" name="name" value={formData.name} disabled />
          </div>
          <div>
            <Label>Start DateTime (Asia/Kolkata)</Label>
            <DateTimePicker
              value={formData.start_datetime}
              onChange={value => handleDateChange('start_datetime', value)}
              format="y-MM-dd HH:mm"
              className="mt-1"
              disabled
            />
          </div>
          <div>
            <Label>End DateTime (Asia/Kolkata)</Label>
            <DateTimePicker
              value={formData.end_datetime}
              onChange={value => handleDateChange('end_datetime', value)}
              format="y-MM-dd HH:mm"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="duration_minutes">Duration (minutes)</Label>
            <Input
              id="duration_minutes"
              name="duration_minutes"
              type="number"
              value={formData.duration_minutes}
              onChange={handleChange}
              required
            />
          </div>
          <div>
            <Label>Questions</Label>
            {formData.questions.length === 0 ? (
              <p className="text-sm text-gray-500">No questions added yet.</p>
            ) : (
              <ul className="space-y-2">
                {formData.questions.map((q, index) => (
                  <li key={q.id || index} className="p-2 bg-gray-100 rounded">
                    <span>
                      Question {index + 1}: {q.description || 'Untitled'} ({q.question_category})
                      {q.id && <span className="ml-2 text-gray-500">(Existing, cannot be modified)</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => openQuestionPanel('objective')}
              variant="outline"
            >
              Add Objective Question
            </Button>
            <Button
              type="button"
              onClick={() => openQuestionPanel('coding')}
              variant="outline"
            >
              Add Coding Question
            </Button>
          </div>
          <Button type="submit" className="w-full">Extend Contest</Button>
        </form>
      </div>

      {isPanelOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex justify-end z-40"
          onClick={closeQuestionPanel}
        >
          <div
            className="w-1/2 bg-white p-6 overflow-y-auto"
            style={{ top: '64px', bottom: 0, position: 'fixed', zIndex: 50 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Add New Question</h2>
              <Button variant="ghost" onClick={closeQuestionPanel}>
                Close
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <Label>Question Type</Label>
                {currentQuestion.question_category === 'objective' ? (
                  <Select
                    value={currentQuestion.type}
                    onValueChange={value => handleQuestionChange('type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mcq">MCQ</SelectItem>
                      <SelectItem value="msq">MSQ</SelectItem>
                      <SelectItem value="blank">Blank</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input disabled value="Coding" />
                )}
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={currentQuestion.description || ''}
                  onChange={e => handleQuestionChange('description', e.target.value)}
                />
              </div>
              {currentQuestion.question_category === 'objective' &&
                (currentQuestion.type === 'mcq' || currentQuestion.type === 'msq') && (
                  <div>
                    <Label>Options</Label>
                    {currentQuestion.options.map((opt, optIndex) => (
                      <div key={optIndex} className="flex gap-2 mb-2">
                        <Input
                          placeholder={`Option ${optIndex + 1}`}
                          value={opt || ''}
                          onChange={e => handleOptionChange(optIndex, e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          onClick={() => removeOption(optIndex)}
                          disabled={currentQuestion.options.length === 1}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                    <Button type="button" variant="outline" onClick={addOption}>
                      Add Option
                    </Button>
                  </div>
                )}
              {currentQuestion.question_category === 'objective' && currentQuestion.type === 'mcq' && (
                <div>
                  <Label>Correct Option</Label>
                  {currentQuestion.options.map((opt, optIndex) => (
                    <div key={optIndex} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="correct-option"
                        checked={currentQuestion.answer?.includes(opt)}
                        onChange={() => handleQuestionChange('answer', [opt])}
                      />
                      <span>{opt || 'Empty option'}</span>
                    </div>
                  ))}
                </div>
              )}
              {currentQuestion.question_category === 'objective' && currentQuestion.type === 'msq' && (
                <div>
                  <Label>Correct Options</Label>
                  {currentQuestion.options.map((opt, optIndex) => (
                    <div key={optIndex} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={currentQuestion.answer?.includes(opt)}
                        onChange={e => {
                          const current = new Set(currentQuestion.answer || []);
                          if (e.target.checked) {
                            current.add(opt);
                          } else {
                            current.delete(opt);
                          }
                          handleQuestionChange('answer', Array.from(current));
                        }}
                      />
                      <span>{opt || 'Empty option'}</span>
                    </div>
                  ))}
                </div>
              )}
              {currentQuestion.question_category === 'objective' && currentQuestion.type === 'blank' && (
                <div>
                  <Label>Correct Answer</Label>
                  <Input
                    value={currentQuestion.answer?.[0] || ''}
                    onChange={e => handleQuestionChange('answer', [e.target.value])}
                  />
                </div>
              )}
              {currentQuestion.question_category === 'coding' && (
                <>
                  <div>
                    <Label>Time Limit (seconds)</Label>
                    <Input
                      type="number"
                      value={currentQuestion.time_limit_seconds || 1}
                      onChange={e => handleQuestionChange('time_limit_seconds', parseInt(e.target.value))}
                    />
                  </div>
                  <div>
                    <Label>Input Files (.txt, at least two)</Label>
                    <Input
                      type="file"
                      accept=".txt"
                      multiple
                      onChange={e => handleFileUpload('input_files', e.target.files)}
                    />
                    {currentQuestion.input_files.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {currentQuestion.input_files.map((file, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <Checkbox
                              checked={currentQuestion.test_cases[i]?.visible ?? (i === 0)}
                              onCheckedChange={checked => handleTestCaseVisibility(i, checked)}
                            />
                            <span>{file.name}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <Label>Output Files (.txt, at least two)</Label>
                    <Input
                      type="file"
                      accept=".txt"
                      multiple
                      onChange={e => handleFileUpload('output_files', e.target.files)}
                    />
                    {currentQuestion.output_files.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {currentQuestion.output_files.map((file, i) => (
                          <li key={i}>{file.name}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {currentQuestion.test_cases.length > 0 && (
                    <div>
                      <Label>Test Cases</Label>
                      <ul className="mt-2 space-y-1">
                        {currentQuestion.test_cases.map((tc, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <Checkbox
                              checked={tc.visible}
                              onCheckedChange={checked => handleTestCaseVisibility(i, checked)}
                            />
                            <span>Test Case {i + 1}: {tc.input ? 'Input set' : 'No input'}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
              <div>
                <Label>Score</Label>
                <Input
                  type="number"
                  value={currentQuestion.score || 1}
                  onChange={e => handleQuestionChange('score', parseInt(e.target.value))}
                />
              </div>
              <Button type="button" onClick={saveQuestion} className="w-full">
                Save Question
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditContest;