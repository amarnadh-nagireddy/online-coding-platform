import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { X } from 'lucide-react';
import axios from 'axios';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { cpp } from '@codemirror/lang-cpp';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { dracula } from '@uiw/codemirror-theme-dracula';
import ErrorBoundary from '@/components/ErrorBoundary';

const ContestAttempt = () => {
  const { contestId } = useParams();
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [contest, setContest] = useState(null);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState({});
  const [scores, setScores] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [testStarted, setTestStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [runResults, setRunResults] = useState([]);
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [actionAttempts, setActionAttempts] = useState({ refresh: 0, fullscreen: 0, tab: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showPopup, setShowPopup] = useState({ visible: false, message: '', autoClose: false });
  const historyRef = useRef(window.history.state);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowPopup({
        visible: true,
        message: 'Please log in to attempt the contest.',
        autoClose: false,
      });
      setTimeout(() => navigate('/login'), 2000);
      return;
    }

    const fetchContest = async () => {
      try {
        const response = await axios.get(`/api/contests/student/attempt/${contestId}/`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        });
        setContest(response.data);
        setTimeRemaining(response.data.time_remaining);
        const initialAnswers = {};
        const initialScores = {};
        response.data.questions.forEach(q => {
          initialAnswers[q.id] = q.type === 'msq' ? [] : q.type === 'coding' ? (q.initial_code || '') : '';
          initialScores[q.id] = 0;
        });
        setAnswers(initialAnswers);
        setScores(initialScores);
      } catch (error) {
        console.error('Error fetching contest:', error);
        setError(error.response?.data?.error || 'Failed to load contest.');
      }
    };

    fetchContest();
  }, [contestId, isAuthenticated, navigate]);

  useEffect(() => {
    if (testStarted && timeRemaining > 0) {
      const timerId = setInterval(() => {
        setTimeRemaining(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timerId);
    } else if (timeRemaining === 0 && testStarted && !isSubmitting) {
      handleSubmit(true);
    }
  }, [testStarted, timeRemaining, isSubmitting]);

  useEffect(() => {
    const handleAction = (type) => {
      setActionAttempts(prev => {
        const newAttempts = { ...prev, [type]: prev[type] + 1 };
        const remaining = 3 - newAttempts[type];
        if (newAttempts[type] >= 3) {
          setShowPopup({
            visible: true,
            message: `Too many ${type} attempts. Submitting test.`,
            autoClose: true,
          });
          setTimeout(() => handleSubmit(true), 2000);
        } else {
          setShowPopup({
            visible: true,
            message: `Warning: ${type.charAt(0).toUpperCase() + type.slice(1)} detected. Test will end after ${remaining} more attempt${remaining > 1 ? 's' : ''}.`,
            autoClose: true,
          });
        }
        return newAttempts;
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleAction('tab');
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && testStarted) {
        handleAction('fullscreen');
      }
    };

    const handleBeforeUnload = (e) => {
      if (testStarted && !isSubmitting) {
        e.preventDefault();
        handleAction('refresh');
        return (e.returnValue = 'Leaving will end the test. Are you sure?');
      }
    };

    const handlePopState = () => {
      if (testStarted && !isSubmitting) {
        setShowPopup({
          visible: true,
          message: 'Navigation attempt detected. Ending test.',
          autoClose: true,
        });
        setTimeout(() => handleSubmit(true), 2000);
        window.history.pushState(historyRef.current, '', window.location.href);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    window.history.pushState(historyRef.current, '', window.location.href);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('popstate', handlePopState);
    };
  }, [testStarted, isSubmitting]);

  useEffect(() => {
    if (contest && contest.questions.length > 0) {
      const currentQ = contest.questions[currentQuestion];
      const initialCode = typeof answers[currentQ.id] === 'string' ? answers[currentQ.id] : (currentQ.initial_code || '');
      setCode(initialCode);
      setRunResults([]);
    }
  }, [contest, currentQuestion, answers]);

  const handleStartTest = () => {
    setTestStarted(true);
    if (contest && contest.duration_minutes) {
      setTimeRemaining(contest.duration_minutes * 60);
    }
    document.documentElement.requestFullscreen().catch(err => {
      console.error('Failed to enter fullscreen:', err);
      setShowPopup({
        visible: true,
        message: 'Please enable fullscreen to start the test.',
        autoClose: true,
      });
    });
  };

  const handleAnswerChange = (questionId, value) => {
    const question = contest.questions.find(q => q.id === questionId);
    let formattedValue = value;
    if (question.type === 'mcq') {
      formattedValue = [value];
    }
    setAnswers(prev => ({
      ...prev,
      [questionId]: formattedValue,
    }));
    if (question.type !== 'coding') {
      setScores(prev => ({
        ...prev,
        [questionId]: 0,
      }));
    }
  };

  const handleCodeChange = (value) => {
    setCode(value);
    const currentQ = contest.questions[currentQuestion];
    if (currentQ.type === 'coding') {
      setAnswers(prev => ({
        ...prev,
        [currentQ.id]: value,
      }));
    }
  };

  const handleRunCode = async () => {
    setIsRunningCode(true);
    setRunResults([]);
    try {
      const currentQ = contest.questions[currentQuestion];
      const response = await axios.post(
        `/api/contests/code_execution/run`,
        {
          code,
          language,
          test_cases: currentQ.visible_test_cases || [],
          time_limit: currentQ.time_limit_seconds || 1,
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        }
      );

      const results = response.data.results || [];
      setRunResults(results);
      setAnswers(prev => ({
        ...prev,
        [currentQ.id]: code,
      }));
      const passedCount = results.filter(r => r.passed).length;
      const errorCount = results.filter(r => r.error).length;
      setShowPopup({
        visible: true,
        message: `Visible Test Cases: ${passedCount}/${results.length} passed${errorCount > 0 ? `\nErrors detected: ${errorCount}` : ''}`,
        autoClose: true,
      });
    } catch (error) {
      console.error('Error running code:', error);
      setError(error.response?.data?.error || 'Failed to run code.');
    } finally {
      setIsRunningCode(false);
    }
  };

  const handleSubmitCodingQuestion = async () => {
    setIsRunningCode(true);
    setRunResults([]);
    try {
      const currentQ = contest.questions[currentQuestion];
      const allTestCases = [...(currentQ.visible_test_cases || []), ...(currentQ.invisible_test_cases || [])];
      const response = await axios.post(
        `/api/contests/code_execution/run`,
        {
          code,
          language,
          test_cases: allTestCases,
          time_limit: currentQ.time_limit_seconds || 1,
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        }
      );

      const results = response.data.results || [];
      setRunResults(results);
      setAnswers(prev => ({
        ...prev,
        [currentQ.id]: code,
      }));
      const passedCount = results.filter(r => r.passed).length;
      const errorCount = results.filter(r => r.error).length;
      const totalScore = passedCount === results.length ? currentQ.score : 0;
      setScores(prev => ({
        ...prev,
        [currentQ.id]: totalScore,
      }));
      setShowPopup({
        visible: true,
        message: `Test Cases: ${passedCount}/${results.length} passed${errorCount > 0 ? `\nErrors detected: ${errorCount}` : ''}\nScore for this question: ${totalScore}/${currentQ.score}`,
        autoClose: true,
      });
    } catch (error) {
      console.error('Error submitting coding question:', error);
      setError(error.response?.data?.error || 'Failed to submit coding question.');
    } finally {
      setIsRunningCode(false);
    }
  };

  const handleSubmit = async (confirmed = false) => {
    if (isSubmitting) return;
    if (!confirmed) {
      setShowConfirmDialog(true);
      return;
    }

    setIsSubmitting(true);
    try {
      const currentQ = contest.questions[currentQuestion];
      if (currentQ.type === 'coding') {
        setRunResults([]);
        const allTestCases = [...(currentQ.visible_test_cases || []), ...(currentQ.invisible_test_cases || [])];
        const codeRunResponse = await axios.post(
          `/api/contests/code_execution/run`,
          {
            code: answers[currentQ.id] || '',
            language,
            test_cases: allTestCases,
            time_limit: currentQ.time_limit_seconds || 1,
          },
          {
            headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
          }
        );
        setRunResults(codeRunResponse.data.results || []);
      }

      const submissionData = contest.questions.map(question => ({
        question_id: question.id,
        answer: answers[question.id] || (question.type === 'msq' ? [] : question.type === 'coding' ? '' : ''),
      }));

      const response = await axios.post(
        `/api/contests/${contestId}/submit`,
        {
          submission: submissionData,
          language,
          back_attempts: actionAttempts.tab,
          fullscreen_attempts: actionAttempts.fullscreen,
        },
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
        }
      );

      const newScores = {};
      let totalPassed = 0;
      let totalTestCases = 0;
      response.data.test_case_results.forEach(result => {
        newScores[result.question_id] = result.score;
        if (result.type === 'coding' && result.test_results) {
          const passed = result.test_results.filter(tr => tr.passed).length;
          totalPassed += passed;
          totalTestCases += result.test_results.length;
        }
      });
      setScores(newScores);
      setShowSuccess(true);
      const codingQuestions = contest.questions.filter(q => q.type === 'coding');
      if (codingQuestions.length > 0) {
        const errorCount = response.data.test_case_results
          .filter(r => r.type === 'coding' && r.test_results)
          .flatMap(r => r.test_results)
          .filter(tr => tr.error).length;
        setShowPopup({
          visible: true,
          message: `Test submitted!\nTotal Test Cases: ${totalPassed}/${totalTestCases} passed${errorCount > 0 ? `\nErrors detected: ${errorCount}` : ''}`,
          autoClose: true,
        });
      } else {
        setShowPopup({
          visible: true,
          message: 'Test submitted successfully!',
          autoClose: true,
        });
      }
      setTimeout(() => {
        document.exitFullscreen().catch(() => {});
        navigate('/');
      }, 3000);
    } catch (error) {
      console.error('Error submitting test:', error);
      const errorMessage = error.response?.data?.error || 'Failed to submit test.';
      setError(errorMessage);
      console.log('Submission error details:', error.response?.data);
    } finally {
      setIsSubmitting(false);
      setShowConfirmDialog(false);
    }
  };

  const getLanguageExtension = () => {
    switch (language) {
      case 'python':
        return python();
      case 'cpp':
        return cpp();
      case 'java':
        return java();
      case 'c':
        return javascript();
      default:
        return python();
    }
  };

  const TestCasePanel = ({ results, title }) => (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">{title}</h3>
      {results.length === 0 ? (
        <p className="text-gray-500">No results available. Run or submit the code to see results.</p>
      ) : (
        results.map((result, idx) => (
          <div
            key={idx}
            className="bg-white p-4 rounded-lg shadow-sm border border-gray-200"
            role="region"
            aria-label={`Test case ${idx + 1}`}
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Input</p>
                <pre className="mt-1 p-2 bg-gray-50 rounded text-sm whitespace-pre-wrap">
                  {result.input || 'N/A'}
                </pre>
              </div>
              <div>
                <p className="text-sm text-gray-500">Expected Output</p>
                <pre className="mt-1 p-2 bg-gray-50 rounded text-sm whitespace-pre-wrap">
                  {result.expected_output || 'N/A'}
                </pre>
              </div>
            </div>
            <div className="mt-4">
              <p className="text-sm text-gray-500">Your Output</p>
              <pre className="mt-1 p-2 bg-gray-50 rounded text-sm whitespace-pre-wrap">
                {result.output || 'No output'}
              </pre>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span
                className={`px-3 py-1 rounded-full text-sm ${
                  result.passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {result.passed ? '✓ Passed' : '× Failed'}
              </span>
              {result.error && (
                <p className="text-red-500 text-sm max-w-xs">
                  <strong>Error:</strong> {result.error}
                </p>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );

  const PopupDialog = ({ message, onClose, autoClose }) => {
    useEffect(() => {
      if (autoClose) {
        const timer = setTimeout(() => onClose(), 3000);
        return () => clearTimeout(timer);
      }
    }, [autoClose, onClose]);

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold">Notification</h2>
            <Button variant="ghost" onClick={onClose} aria-label="Close popup">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <p className="mb-6 whitespace-pre-wrap">{message}</p>
          {!autoClose && (
            <div className="flex justify-end">
              <Button onClick={onClose}>OK</Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!contest) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-600">Loading...</div>
      </div>
    );
  }

  const currentQ = contest.questions[currentQuestion];
  const currentAnswer = answers[currentQ.id];
  const formatTimeRemaining = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {testStarted && (
        <div className="fixed top-0 left-0 right-0 bg-gray-800 text-white p-3 flex justify-between items-center z-50">
          <p className="text-lg font-semibold">
            Time Remaining: {formatTimeRemaining(timeRemaining)}
          </p>
          <Button
            onClick={() => handleSubmit(false)}
            disabled={timeRemaining <= 0 || isSubmitting}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Submit Test
          </Button>
        </div>
      )}

      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Confirm Submission</h2>
            <p className="mb-6">Are you sure you want to submit the test? This action cannot be undone.</p>
            <div className="flex gap-4 justify-end">
              <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => handleSubmit(true)} disabled={isSubmitting}>
                Submit
              </Button>
            </div>
          </div>
        </div>
      )}

      {showPopup.visible && (
        <PopupDialog
          message={showPopup.message}
          onClose={() => setShowPopup({ visible: false, message: '', autoClose: false })}
          autoClose={showPopup.autoClose}
        />
      )}

      {!testStarted ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-md text-center bg-white p-8 rounded-lg shadow-md">
            <h1 className="text-2xl font-bold mb-4">{contest.name}</h1>
            <p className="text-lg mb-6 text-gray-600">
              Click below to start the test. You will have {contest.duration_minutes} minutes.
            </p>
            <Button onClick={handleStartTest} className="w-48 h-12">
              Start Test
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex pt-12">
          <div className="w-16 bg-gray-100 p-2 flex flex-col items-center gap-2">
            {contest.questions.map((_, index) => (
              <Button
                key={index}
                onClick={() => setCurrentQuestion(index)}
                variant={currentQuestion === index ? 'default' : 'outline'}
                className="w-10 h-10 rounded-full"
                aria-label={`Go to question ${index + 1}`}
              >
                {index + 1}
              </Button>
            ))}
          </div>

          <div className="flex-1 flex">
            {currentQ.type === 'coding' ? (
              <>
                <div className="w-1/2 p-4 bg-white rounded-lg shadow-md m-2 overflow-y-auto">
                  <h2 className="text-2xl font-bold mb-4">{currentQ.description}</h2>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">Visible Test Cases</h3>
                    {currentQ.visible_test_cases?.length > 0 ? (
                      currentQ.visible_test_cases.map((tc, idx) => (
                        <div key={idx} className="mb-4">
                          <p className="text-sm text-gray-500">Test Case {idx + 1}</p>
                          <div className="grid grid-cols-2 gap-4 mt-1">
                            <div>
                              <p className="text-sm text-gray-500">Input</p>
                              <pre className="p-2 bg-gray-50 rounded text-sm whitespace-pre-wrap">
                                {tc.input || 'N/A'}
                              </pre>
                            </div>
                            <div>
                              <p className="text-sm text-gray-500">Output</p>
                              <pre className="p-2 bg-gray-50 rounded text-sm whitespace-pre-wrap">
                                {tc.output || 'N/A'}
                              </pre>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500">No visible test cases available.</p>
                    )}
                  </div>
                </div>

                <div className="w-1/2 p-4 flex flex-col m-2">
                  <div className="flex-1 bg-white rounded-lg shadow-md p-4">
                    <select
                      value={language}
                      onChange={e => setLanguage(e.target.value)}
                      className="w-48 p-2 border rounded mb-4"
                      disabled={timeRemaining <= 0}
                      aria-label="Select programming language"
                    >
                      <option value="python">Python</option>
                      <option value="cpp">C++</option>
                      <option value="java">Java</option>
                      <option value="c">C</option>
                    </select>
                    <ErrorBoundary>
                      <CodeMirror
                        value={code}
                        height="400px"
                        extensions={[getLanguageExtension()]}
                        theme={dracula}
                        onChange={handleCodeChange}
                        basicSetup={{
                          lineNumbers: true,
                          highlightActiveLine: true,
                          tabSize: 2,
                          autocompletion: true,
                        }}
                        style={{ fontSize: '14px' }}
                      />
                    </ErrorBoundary>
                  </div>

                  <div className="mt-4">
                    <div className="flex gap-4 mb-4 flex-wrap">
                      <Button
                        onClick={handleRunCode}
                        disabled={timeRemaining <= 0 || isRunningCode}
                        variant="outline"
                      >
                        {isRunningCode ? 'Running...' : 'Run Code'}
                      </Button>
                      <Button
                        onClick={handleSubmitCodingQuestion}
                        disabled={timeRemaining <= 0 || isRunningCode}
                        variant="outline"
                      >
                        Submit
                      </Button>
                    </div>
                    <TestCasePanel results={runResults} title="Test Case Results" />
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 p-4 bg-white rounded-lg shadow-md m-2">
                <h2 className="text-2xl font-bold mb-4">{currentQ.description}</h2>
                {currentQ.type === 'mcq' ? (
                  <div className="space-y-4">
                    {currentQ.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <Input
                          type="radio"
                          id={`option-${index}`}
                          name="mcq-option"
                          value={option}
                          checked={Array.isArray(currentAnswer) && currentAnswer[0] === option}
                          onChange={() => handleAnswerChange(currentQ.id, option)}
                          className="h-5 w-5"
                          disabled={timeRemaining <= 0}
                          aria-label={`Option ${index + 1}: ${option}`}
                        />
                        <label
                          htmlFor={`option-${index}`}
                          className="text-gray-700 text-lg"
                        >
                          {option}
                        </label>
                      </div>
                    ))}
                  </div>
                ) : currentQ.type === 'msq' ? (
                  <div className="space-y-4">
                    {currentQ.options.map((option, index) => (
                      <div key={index} className="flex items-center gap-3">
                        <Input
                          type="checkbox"
                          id={`option-${index}`}
                          value={option}
                          checked={Array.isArray(currentAnswer) && currentAnswer.includes(option)}
                          onChange={e => {
                            const newAnswers = Array.isArray(currentAnswer) ? [...currentAnswer] : [];
                            if (e.target.checked) {
                              newAnswers.push(option);
                            } else {
                              const idx = newAnswers.indexOf(option);
                              if (idx > -1) newAnswers.splice(idx, 1);
                            }
                            handleAnswerChange(currentQ.id, newAnswers);
                          }}
                          className="h-5 w-5"
                          disabled={timeRemaining <= 0}
                          aria-label={`Option ${index + 1}: ${option}`}
                        />
                        <label
                          htmlFor={`option-${index}`}
                          className="text-gray-700 text-lg"
                        >
                          {option}
                        </label>
                      </div>
                    ))}
                  </div>
                ) : currentQ.type === 'blank' ? (
                  <div className="space-y-4">
                    <Input
                      type="text"
                      placeholder="Your Answer"
                      value={currentAnswer || ''}
                      onChange={e => handleAnswerChange(currentQ.id, e.target.value)}
                      className="w-full p-3 border rounded text-lg"
                      disabled={timeRemaining <= 0}
                      aria-label="Blank answer input"
                    />
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}

      {showSuccess && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Alert className="max-w-md">
            <AlertTitle>Success</AlertTitle>
            <AlertDescription>
              Test submitted successfully! Your score: {Object.values(scores).reduce((a, b) => a + b, 0)} /{' '}
              {contest.questions.reduce((sum, q) => sum + q.score, 0)}. Redirecting...
            </AlertDescription>
          </Alert>
        </div>
      )}
    </div>
  );
};

export default ContestAttempt;