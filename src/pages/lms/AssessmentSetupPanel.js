/**
 * AssessmentSetupPanel
 * Embedded inside ProgramDetailDrawer to configure MCQ exam questions.
 * Only shown when program.examEnabled === true.
 *
 * Backend APIs used:
 *   GET  /programs/{id}/assessment           — load assessment + questions
 *   PUT  /programs/{id}/assessment           — update settings (passScore, timeLimit, etc.)
 *   POST /programs/{id}/assessment/questions — add a question
 *   PUT  /programs/{id}/assessment/questions/{qId} — update a question
 *   DEL  /programs/{id}/assessment/questions/{qId} — delete a question
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Button, Typography, TextField, MenuItem, Chip, Stack, Alert,
  CircularProgress, Divider, IconButton, Tooltip, Switch, FormControlLabel,
  Collapse, List, ListItem, ListItemText, ListItemSecondaryAction,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Quiz as QuizIcon,
} from '@mui/icons-material';
import {
  getProgramAssessmentApi,
  updateProgramAssessmentApi,
  addQuestionApi,
  updateQuestionApi,
  deleteQuestionApi,
} from '../../api/lmsApi';

const QUESTION_TYPES = [
  { value: 'MULTIPLE_CHOICE', label: 'Multiple Choice (1 correct answer)' },
  { value: 'MULTI_SELECT',    label: 'Multi-Select (multiple correct answers)' },
  { value: 'TRUE_FALSE',      label: 'True / False' },
  { value: 'SHORT_ANSWER',    label: 'Short Answer (manual review)' },
];

const BLANK_QUESTION = {
  questionType: 'MULTIPLE_CHOICE',
  questionText: '',
  options: ['', '', '', ''],
  correctAnswer: '',
  explanation: '',
  marks: 1,
  displayOrder: 1,
};

// ── Option list editor ────────────────────────────────────────────────────────
const OptionsEditor = ({ options, correctAnswer, onChange, onCorrectChange }) => (
  <Box>
    <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
      OPTIONS
    </Typography>
    {options.map((opt, i) => (
      <Box key={i} sx={{ display: 'flex', gap: 1, mb: 0.75, alignItems: 'center' }}>
        <TextField
          size="small"
          sx={{ flex: 1 }}
          placeholder={`Option ${String.fromCharCode(65 + i)}`}
          value={opt}
          onChange={(e) => {
            const updated = [...options];
            updated[i] = e.target.value;
            onChange(updated);
          }}
        />
        <Chip
          label={opt === correctAnswer ? '✓ Correct' : 'Set correct'}
          size="small"
          color={opt === correctAnswer ? 'success' : 'default'}
          variant={opt === correctAnswer ? 'filled' : 'outlined'}
          onClick={() => opt && onCorrectChange(opt)}
          sx={{ cursor: 'pointer', minWidth: 90 }}
        />
      </Box>
    ))}
    <Button
      size="small"
      onClick={() => onChange([...options, ''])}
      sx={{ mt: 0.5 }}
    >
      + Add Option
    </Button>
  </Box>
);

// ── Question Form ─────────────────────────────────────────────────────────────
const QuestionForm = ({ initial, programId, onSaved, onCancel }) => {
  const [form,   setForm]   = useState(initial || BLANK_QUESTION);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  const update = (field, val) => setForm((p) => ({ ...p, [field]: val }));

  const handleSave = async () => {
    if (!form.questionText.trim()) { setError('Question text is required.'); return; }
    if (['MULTIPLE_CHOICE', 'MULTI_SELECT'].includes(form.questionType)) {
      if (!form.correctAnswer) { setError('Please select the correct answer.'); return; }
    }
    setSaving(true); setError(null);
    try {
      const payload = {
        questionType:  form.questionType,
        questionText:  form.questionText,
        marks:         Number(form.marks) || 1,
        displayOrder:  Number(form.displayOrder) || 1,
        explanation:   form.explanation || undefined,
        ...((['MULTIPLE_CHOICE', 'MULTI_SELECT', 'TRUE_FALSE'].includes(form.questionType)) && {
          options:       form.questionType === 'TRUE_FALSE' ? ['True', 'False'] : form.options.filter(Boolean),
          correctAnswer: form.correctAnswer,
        }),
      };

      if (form.id) {
        await updateQuestionApi(programId, form.id, payload);
      } else {
        await addQuestionApi(programId, payload);
      }
      onSaved();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save question.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2, mb: 1 }}>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>
        {form.id ? 'Edit Question' : 'New Question'}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

      <TextField
        label="Question Type" select size="small" fullWidth sx={{ mb: 1.5 }}
        value={form.questionType}
        onChange={(e) => update('questionType', e.target.value)}
      >
        {QUESTION_TYPES.map(({ value, label }) => (
          <MenuItem key={value} value={value}>{label}</MenuItem>
        ))}
      </TextField>

      <TextField
        label="Question Text *" multiline rows={2} fullWidth size="small" sx={{ mb: 1.5 }}
        value={form.questionText}
        onChange={(e) => update('questionText', e.target.value)}
      />

      {['MULTIPLE_CHOICE', 'MULTI_SELECT'].includes(form.questionType) && (
        <Box sx={{ mb: 1.5 }}>
          <OptionsEditor
            options={form.options}
            correctAnswer={form.correctAnswer}
            onChange={(opts) => update('options', opts)}
            onCorrectChange={(ans) => update('correctAnswer', ans)}
          />
        </Box>
      )}

      {form.questionType === 'TRUE_FALSE' && (
        <TextField
          label="Correct Answer" select size="small" fullWidth sx={{ mb: 1.5 }}
          value={form.correctAnswer}
          onChange={(e) => update('correctAnswer', e.target.value)}
        >
          <MenuItem value="True">True</MenuItem>
          <MenuItem value="False">False</MenuItem>
        </TextField>
      )}

      {form.questionType === 'SHORT_ANSWER' && (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Short answer questions require manual review by a manager after submission.
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 1.5, mb: 1 }}>
        <TextField
          label="Marks" type="number" size="small" sx={{ width: 100 }}
          value={form.marks}
          onChange={(e) => update('marks', e.target.value)}
          inputProps={{ min: 1 }}
        />
        <TextField
          label="Display Order" type="number" size="small" sx={{ width: 120 }}
          value={form.displayOrder}
          onChange={(e) => update('displayOrder', e.target.value)}
          inputProps={{ min: 1 }}
        />
      </Box>

      <TextField
        label="Explanation (optional)" size="small" fullWidth sx={{ mb: 1.5 }}
        value={form.explanation}
        onChange={(e) => update('explanation', e.target.value)}
        helperText="Shown to trainees after they submit the exam"
      />

      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button onClick={onCancel} disabled={saving} size="small">Cancel</Button>
        <Button
          variant="contained" size="small" onClick={handleSave} disabled={saving}
          startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />}
        >
          {saving ? 'Saving…' : (form.id ? 'Update' : 'Add Question')}
        </Button>
      </Box>
    </Box>
  );
};

// ── Main Panel ────────────────────────────────────────────────────────────────
const AssessmentSetupPanel = ({ programId, programExamEnabled }) => {
  const [assessment,  setAssessment]  = useState(null);
  const [questions,   setQuestions]   = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addingQ,     setAddingQ]     = useState(false);
  const [editingQ,    setEditingQ]    = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    title: '', instructions: '', timeLimitMinutes: 30, passScore: 70,
    randomiseQuestions: false, randomiseAnswers: false,
  });

  const load = useCallback(async () => {
    if (!programId || !programExamEnabled) return;
    setLoading(true); setError(null);
    try {
      const { data } = await getProgramAssessmentApi(programId);
      const a = data?.data || data;
      setAssessment(a);
      setQuestions(a?.questions || []);
      if (a) {
        setSettingsForm({
          title:               a.title || '',
          instructions:        a.instructions || '',
          timeLimitMinutes:    a.timeLimitMinutes || 30,
          passScore:           a.passScore || 70,
          randomiseQuestions:  a.randomiseQuestions || false,
          randomiseAnswers:    a.randomiseAnswers || false,
        });
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load assessment.');
    } finally {
      setLoading(false);
    }
  }, [programId, programExamEnabled]);

  useEffect(() => { load(); }, [load]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateProgramAssessmentApi(programId, {
        ...settingsForm,
        timeLimitMinutes: Number(settingsForm.timeLimitMinutes),
        passScore:        Number(settingsForm.passScore),
      });
      await load();
      setSettingsOpen(false);
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save settings.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleDeleteQuestion = async (qId) => {
    if (!window.confirm('Delete this question?')) return;
    try {
      await deleteQuestionApi(programId, qId);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete question.');
    }
  };

  if (!programExamEnabled) return null;

  return (
    <Box>
      <Divider sx={{ my: 2 }} />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <QuizIcon fontSize="small" color="primary" />
          <Typography variant="subtitle2" fontWeight={700}>
            Online Exam Setup
            {questions.length > 0 && (
              <Chip label={`${questions.length} Q`} size="small" sx={{ ml: 1 }} />
            )}
            {assessment?.totalMarks > 0 && (
              <Chip label={`${assessment.totalMarks} marks`} size="small" color="primary" variant="outlined" sx={{ ml: 0.5 }} />
            )}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => setSettingsOpen((p) => !p)}
            endIcon={settingsOpen ? <CollapseIcon /> : <ExpandIcon />}
          >
            Settings
          </Button>
          <Button
            size="small"
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => { setAddingQ(true); setEditingQ(null); }}
          >
            Add Question
          </Button>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {loading && <Box sx={{ py: 2, textAlign: 'center' }}><CircularProgress size={20} /></Box>}

      {/* Assessment Settings */}
      <Collapse in={settingsOpen}>
        <Box sx={{ p: 2, bgcolor: 'primary.50', border: '1px solid', borderColor: 'primary.200', borderRadius: 2, mb: 1.5 }}>
          <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 1, textTransform: 'uppercase' }}>
            Exam Settings
          </Typography>
          <TextField
            label="Exam Title" size="small" fullWidth sx={{ mb: 1.5 }}
            value={settingsForm.title}
            onChange={(e) => setSettingsForm((p) => ({ ...p, title: e.target.value }))}
          />
          <TextField
            label="Instructions" multiline rows={2} size="small" fullWidth sx={{ mb: 1.5 }}
            value={settingsForm.instructions}
            onChange={(e) => setSettingsForm((p) => ({ ...p, instructions: e.target.value }))}
          />
          <Box sx={{ display: 'flex', gap: 1.5, mb: 1 }}>
            <TextField
              label="Time Limit (min)" type="number" size="small" sx={{ flex: 1 }}
              value={settingsForm.timeLimitMinutes}
              onChange={(e) => setSettingsForm((p) => ({ ...p, timeLimitMinutes: e.target.value }))}
              inputProps={{ min: 5 }}
            />
            <TextField
              label="Pass Score (%)" type="number" size="small" sx={{ flex: 1 }}
              value={settingsForm.passScore}
              onChange={(e) => setSettingsForm((p) => ({ ...p, passScore: e.target.value }))}
              inputProps={{ min: 0, max: 100 }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={settingsForm.randomiseQuestions}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, randomiseQuestions: e.target.checked }))}
                />
              }
              label={<Typography variant="body2">Randomise Questions</Typography>}
            />
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={settingsForm.randomiseAnswers}
                  onChange={(e) => setSettingsForm((p) => ({ ...p, randomiseAnswers: e.target.checked }))}
                />
              }
              label={<Typography variant="body2">Randomise Answers</Typography>}
            />
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1.5, gap: 1 }}>
            <Button size="small" onClick={() => setSettingsOpen(false)}>Cancel</Button>
            <Button
              size="small" variant="contained" onClick={handleSaveSettings}
              disabled={savingSettings}
              startIcon={savingSettings ? <CircularProgress size={14} /> : <SaveIcon />}
            >
              {savingSettings ? 'Saving…' : 'Save Settings'}
            </Button>
          </Box>
        </Box>
      </Collapse>

      {/* Add / Edit Question Form */}
      {addingQ && (
        <QuestionForm
          initial={editingQ ? { ...editingQ } : null}
          programId={programId}
          onSaved={() => { setAddingQ(false); setEditingQ(null); load(); }}
          onCancel={() => { setAddingQ(false); setEditingQ(null); }}
        />
      )}

      {/* Questions List */}
      {!loading && questions.length === 0 && !addingQ && (
        <Box sx={{ py: 2, textAlign: 'center', color: 'text.secondary' }}>
          <Typography variant="caption">No questions yet. Click "Add Question" to get started.</Typography>
        </Box>
      )}

      {questions.length > 0 && (
        <List dense disablePadding>
          {questions.map((q, i) => (
            <ListItem
              key={q.id}
              sx={{
                border: '1px solid', borderColor: 'divider', borderRadius: 1,
                mb: 0.75, bgcolor: 'background.paper',
                flexDirection: 'column', alignItems: 'flex-start',
                pr: 8,
              }}
            >
              <Box sx={{ display: 'flex', width: '100%', alignItems: 'center', gap: 1 }}>
                <Chip
                  label={`Q${i + 1}`}
                  size="small"
                  sx={{ fontFamily: 'monospace', fontWeight: 700, minWidth: 32 }}
                />
                <Chip
                  label={QUESTION_TYPES.find((t) => t.value === q.questionType)?.label?.split(' (')[0] || q.questionType}
                  size="small"
                  variant="outlined"
                  color="primary"
                />
                <Chip label={`${q.marks} mark${q.marks !== 1 ? 's' : ''}`} size="small" />
                <Box sx={{ ml: 'auto', display: 'flex', gap: 0.5 }}>
                  <Tooltip title="Edit">
                    <IconButton
                      size="small"
                      onClick={() => { setEditingQ(q); setAddingQ(true); }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={() => handleDeleteQuestion(q.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              <Typography variant="body2" sx={{ mt: 0.75, color: 'text.primary' }}>
                {q.questionText}
              </Typography>
              {q.options?.length > 0 && (
                <Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                  {q.options.map((opt) => (
                    <Chip
                      key={opt}
                      label={opt}
                      size="small"
                      color={opt === q.correctAnswer ? 'success' : 'default'}
                      variant={opt === q.correctAnswer ? 'filled' : 'outlined'}
                      sx={{ fontSize: 10 }}
                    />
                  ))}
                </Stack>
              )}
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
};

export default AssessmentSetupPanel;
