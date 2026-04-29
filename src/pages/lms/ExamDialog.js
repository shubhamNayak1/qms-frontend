import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Alert, CircularProgress, Typography, Box,
  Chip, Divider, Stack, RadioGroup, FormControlLabel, Radio,
  FormGroup, Checkbox, TextField, LinearProgress, Stepper,
  Step, StepLabel, IconButton, Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  Quiz as QuizIcon,
  CheckCircle as PassIcon,
  Cancel as FailIcon,
  Refresh as RefreshIcon,
  NavigateNext as NextIcon,
  NavigateBefore as PrevIcon,
} from '@mui/icons-material';
import {
  startAssessmentApi,
  submitAssessmentApi,
  getAssessmentAttemptsApi,
} from '../../api/lmsApi';

// ── Question Renderer ─────────────────────────────────────────────────────────
const QuestionCard = ({ question, answer, onChange, idx, total }) => {
  const { id, questionType, questionText, options = [], marks } = question;

  const handleMultiSelect = (opt) => {
    const current = answer ? answer.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const updated = current.includes(opt)
      ? current.filter((o) => o !== opt)
      : [...current, opt];
    onChange(String(id), updated.join(','));
  };

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          QUESTION {idx + 1} OF {total}
        </Typography>
        <Chip label={`${marks} mark${marks !== 1 ? 's' : ''}`} size="small" variant="outlined" />
      </Box>
      <Typography variant="body1" fontWeight={600} sx={{ mb: 2, lineHeight: 1.6 }}>
        {questionText}
      </Typography>

      {questionType === 'MULTIPLE_CHOICE' && (
        <RadioGroup value={answer || ''} onChange={(e) => onChange(String(id), e.target.value)}>
          {options.map((opt) => (
            <FormControlLabel
              key={opt} value={opt} control={<Radio size="small" />} label={opt}
              sx={{ mb: 0.5, px: 1, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
            />
          ))}
        </RadioGroup>
      )}

      {questionType === 'TRUE_FALSE' && (
        <RadioGroup value={answer || ''} onChange={(e) => onChange(String(id), e.target.value)}>
          {['True', 'False'].map((opt) => (
            <FormControlLabel
              key={opt} value={opt} control={<Radio size="small" />} label={opt}
              sx={{ mb: 0.5, px: 1, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
            />
          ))}
        </RadioGroup>
      )}

      {questionType === 'MULTI_SELECT' && (
        <FormGroup>
          {options.map((opt) => {
            const selected = answer ? answer.split(',').map((s) => s.trim()) : [];
            return (
              <FormControlLabel
                key={opt}
                control={
                  <Checkbox
                    size="small"
                    checked={selected.includes(opt)}
                    onChange={() => handleMultiSelect(opt)}
                  />
                }
                label={opt}
                sx={{ mb: 0.5, px: 1, borderRadius: 1, '&:hover': { bgcolor: 'action.hover' } }}
              />
            );
          })}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, pl: 1 }}>
            Select all that apply
          </Typography>
        </FormGroup>
      )}

      {questionType === 'SHORT_ANSWER' && (
        <TextField
          label="Your answer"
          multiline
          rows={3}
          fullWidth
          size="small"
          value={answer || ''}
          onChange={(e) => onChange(String(id), e.target.value)}
          helperText="Short answer — will be manually reviewed by a manager"
        />
      )}
    </Box>
  );
};

// ── Result Panel ──────────────────────────────────────────────────────────────
const ResultPanel = ({ result, programTitle, onClose, onRetry, canRetry }) => {
  const passed   = result?.passed;
  const score    = result?.scorePercent?.toFixed(1);
  const passScore = result?.passScore;
  const status   = result?.status;

  if (status === 'PENDING_REVIEW') {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <QuizIcon sx={{ fontSize: 56, color: 'warning.main', mb: 1 }} />
        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>
          Submitted for Manual Review
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Your answer contains SHORT_ANSWER questions that require manual grading by a manager.
          You'll be notified once reviewed.
        </Typography>
        <Button variant="outlined" onClick={onClose}>Close</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ textAlign: 'center', py: 3 }}>
      {passed ? (
        <PassIcon sx={{ fontSize: 64, color: 'success.main', mb: 1 }} />
      ) : (
        <FailIcon sx={{ fontSize: 64, color: 'error.main', mb: 1 }} />
      )}
      <Typography variant="h5" fontWeight={800} color={passed ? 'success.main' : 'error.main'} sx={{ mb: 0.5 }}>
        {passed ? '🎉 Passed!' : '❌ Failed'}
      </Typography>
      <Typography variant="h3" fontWeight={800} sx={{ mb: 0.5 }}>
        {score}%
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Pass score: {passScore}% &nbsp;|&nbsp; Raw: {result?.rawScore} / {result?.totalMarks}
      </Typography>
      <LinearProgress
        variant="determinate"
        value={Math.min(parseFloat(score), 100)}
        color={passed ? 'success' : 'error'}
        sx={{ height: 10, borderRadius: 5, mb: 3, mx: 4 }}
      />
      {passed && (
        <Alert severity="success" sx={{ mb: 2, textAlign: 'left' }}>
          ✅ Your enrollment is now <strong>COMPLETED</strong>. Certificate will be issued automatically.
        </Alert>
      )}
      {!passed && canRetry && (
        <Alert severity="warning" sx={{ mb: 2, textAlign: 'left' }}>
          You can try again. Attempts remaining.
        </Alert>
      )}
      {!passed && !canRetry && (
        <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
          Maximum attempts reached. Enrollment moved to <strong>RETRAINING</strong>. A new enrollment will be created.
        </Alert>
      )}
      <Stack direction="row" spacing={1} justifyContent="center">
        <Button variant="outlined" onClick={onClose}>Close</Button>
        {!passed && canRetry && (
          <Button variant="contained" color="primary" onClick={onRetry}>
            Retry Exam
          </Button>
        )}
      </Stack>
    </Box>
  );
};

// ── Main ExamDialog ───────────────────────────────────────────────────────────
const ExamDialog = ({ open, onClose, enrollmentId, programTitle, onCompleted }) => {
  const [phase,      setPhase]      = useState('info');   // info | taking | result
  const [attempt,    setAttempt]    = useState(null);
  const [questions,  setQuestions]  = useState([]);
  const [answers,    setAnswers]    = useState({});        // { questionId: answerString }
  const [result,     setResult]     = useState(null);
  const [attempts,   setAttempts]   = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);
  const [currentQ,   setCurrentQ]   = useState(0);

  const loadAttempts = useCallback(async () => {
    if (!enrollmentId) return;
    setLoading(true);
    try {
      const { data } = await getAssessmentAttemptsApi(enrollmentId);
      setAttempts(data?.data || data || []);
    } catch {
      // no attempts yet — that's fine
      setAttempts([]);
    } finally {
      setLoading(false);
    }
  }, [enrollmentId]);

  useEffect(() => {
    if (open) {
      setPhase('info');
      setAttempt(null);
      setQuestions([]);
      setAnswers({});
      setResult(null);
      setError(null);
      setCurrentQ(0);
      loadAttempts();
    }
  }, [open, loadAttempts]);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await startAssessmentApi(enrollmentId);
      const att = data?.data || data;
      setAttempt(att);
      setQuestions(att.questions || []);
      setAnswers({});
      setCurrentQ(0);
      setPhase('taking');
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to start exam. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    const unanswered = questions.filter((q) => !answers[String(q.id)]);
    if (unanswered.length > 0) {
      const confirmGo = window.confirm(
        `${unanswered.length} question(s) unanswered. Submit anyway?`
      );
      if (!confirmGo) return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { data } = await submitAssessmentApi(enrollmentId, { answers });
      setResult(data?.data || data);
      setPhase('result');
      onCompleted?.();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to submit exam.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setPhase('info');
    setResult(null);
    loadAttempts();
  };

  const setAnswer = (qId, val) => setAnswers((prev) => ({ ...prev, [qId]: val }));

  const prevAttempt = attempts[attempts.length - 1];
  const attemptsUsed = prevAttempt?.attemptsUsed || attempts.length;
  const maxAttempts  = prevAttempt?.maxAttempts || '?';
  const answeredCount = questions.filter((q) => answers[String(q.id)]).length;
  const canRetry = result && !result.passed && result.status !== 'RETRAINING';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
        <QuizIcon color="primary" />
        Online MCQ Exam {programTitle ? `— ${programTitle}` : ''}
        <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
          {phase === 'info' && (
            <Tooltip title="Refresh attempts">
              <IconButton size="small" onClick={loadAttempts} disabled={loading}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Close">
            <IconButton size="small" onClick={onClose}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* ── Info / Pre-exam screen ── */}
        {phase === 'info' && (
          <Box>
            {loading && <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress /></Box>}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {!loading && (
              <>
                <Box sx={{ mb: 3, p: 2.5, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200', borderRadius: 2 }}>
                  <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>📋 Exam Instructions</Typography>
                  <Typography variant="body2" sx={{ mb: 0.75 }}>
                    • Read each question carefully before answering.
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 0.75 }}>
                    • MCQ and True/False questions are auto-graded instantly.
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 0.75 }}>
                    • Multi-select: choose all correct options.
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 0.75 }}>
                    • Short answer questions require manual review by a manager.
                  </Typography>
                  <Typography variant="body2">
                    • Once submitted, you cannot change your answers.
                  </Typography>
                </Box>

                {attempts.length > 0 && (
                  <>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Previous Attempts</Typography>
                    <Stack spacing={1} sx={{ mb: 2 }}>
                      {attempts.map((att) => (
                        <Box key={att.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: 'action.hover', borderRadius: 1 }}>
                          <Chip
                            label={att.status}
                            size="small"
                            color={att.status === 'PASSED' ? 'success' : att.status === 'FAILED' ? 'error' : 'warning'}
                          />
                          <Typography variant="caption">Attempt #{att.attemptNumber}</Typography>
                          {att.scorePercent != null && (
                            <Typography variant="caption" fontWeight={700}>
                              {att.scorePercent?.toFixed(1)}%
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Stack>
                    <Divider sx={{ mb: 2 }} />
                  </>
                )}

                <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                  <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2, textAlign: 'center', flex: 1 }}>
                    <Typography variant="h4" fontWeight={800} color="primary.main">{attemptsUsed}</Typography>
                    <Typography variant="caption" color="text.secondary">Attempts Used</Typography>
                  </Box>
                  <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2, textAlign: 'center', flex: 1 }}>
                    <Typography variant="h4" fontWeight={800} color="text.secondary">{maxAttempts}</Typography>
                    <Typography variant="caption" color="text.secondary">Max Attempts</Typography>
                  </Box>
                </Box>

                <Button
                  variant="contained"
                  fullWidth
                  size="large"
                  onClick={handleStart}
                  disabled={loading}
                  startIcon={loading ? <CircularProgress size={18} /> : <QuizIcon />}
                >
                  {loading ? 'Starting…' : 'Start Exam'}
                </Button>
              </>
            )}
          </Box>
        )}

        {/* ── Taking exam ── */}
        {phase === 'taking' && questions.length > 0 && (
          <Box>
            {/* Progress bar */}
            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" fontWeight={600}>
                  Question {currentQ + 1} of {questions.length}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {answeredCount}/{questions.length} answered
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={(answeredCount / questions.length) * 100}
                sx={{ height: 6, borderRadius: 3 }}
              />
            </Box>

            {/* Stepper for question navigation */}
            <Box sx={{ mb: 2, overflow: 'auto' }}>
              <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                {questions.map((q, i) => (
                  <Box
                    key={q.id}
                    onClick={() => setCurrentQ(i)}
                    sx={{
                      width: 32, height: 32, borderRadius: 1, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: answers[String(q.id)]
                        ? 'success.main'
                        : i === currentQ
                          ? 'primary.main'
                          : 'action.hover',
                      color: (answers[String(q.id)] || i === currentQ) ? 'white' : 'text.primary',
                      fontWeight: 700, fontSize: 12,
                      border: i === currentQ ? '2px solid' : 'none',
                      borderColor: 'primary.dark',
                    }}
                  >
                    {i + 1}
                  </Box>
                ))}
              </Stack>
            </Box>

            <Divider sx={{ mb: 2 }} />

            {/* Current question */}
            <QuestionCard
              question={questions[currentQ]}
              answer={answers[String(questions[currentQ]?.id)] || ''}
              onChange={setAnswer}
              idx={currentQ}
              total={questions.length}
            />

            {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

            {/* Navigation */}
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <Button
                startIcon={<PrevIcon />}
                onClick={() => setCurrentQ((p) => p - 1)}
                disabled={currentQ === 0}
                variant="outlined"
              >
                Previous
              </Button>
              <Box sx={{ flex: 1 }} />
              {currentQ < questions.length - 1 ? (
                <Button
                  endIcon={<NextIcon />}
                  onClick={() => setCurrentQ((p) => p + 1)}
                  variant="outlined"
                >
                  Next
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSubmit}
                  disabled={submitting}
                  startIcon={submitting ? <CircularProgress size={14} /> : <PassIcon />}
                >
                  {submitting ? 'Submitting…' : 'Submit Exam'}
                </Button>
              )}
            </Box>
          </Box>
        )}

        {/* ── Result screen ── */}
        {phase === 'result' && result && (
          <ResultPanel
            result={result}
            programTitle={programTitle}
            onClose={onClose}
            onRetry={handleRetry}
            canRetry={canRetry}
          />
        )}
      </DialogContent>

      {phase !== 'result' && (
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onClose} disabled={submitting}>
            {phase === 'taking' ? 'Cancel Exam' : 'Close'}
          </Button>
          {phase === 'taking' && (
            <Button
              variant="contained"
              color="primary"
              onClick={handleSubmit}
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={14} /> : null}
            >
              {submitting ? 'Submitting…' : 'Submit Exam'}
            </Button>
          )}
        </DialogActions>
      )}
    </Dialog>
  );
};

export default ExamDialog;
