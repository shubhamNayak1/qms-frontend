import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, CircularProgress, Alert,
  Stepper, Step, StepLabel, Box, Typography, Divider,
  FormGroup, FormControlLabel, Checkbox, ToggleButton,
  ToggleButtonGroup, Grid, Chip, Paper,
} from '@mui/material';
import {
  TableChart as ExcelIcon,
  ListAlt as CsvIcon,
  InfoOutlined as InfoIcon,
} from '@mui/icons-material';
import { getModuleFieldsApi, createReportApi } from '../../api/reportsApi';

// ── Constants ──────────────────────────────────────────────────────────────
const MODULES = [
  { value: 'CAPA',           label: 'CAPA' },
  { value: 'DEVIATION',      label: 'Deviation' },
  { value: 'INCIDENT',       label: 'Incident' },
  { value: 'CHANGE_CONTROL', label: 'Change Control' },
  { value: 'COMPLAINT',      label: 'Market Complaint' },
  { value: 'LMS_ENROLLMENT', label: 'LMS Enrollment' },
  { value: 'USER',           label: 'Users' },
  { value: 'DEPARTMENT',     label: 'Departments' },
];

const STEPS = ['Basic Info', 'Date & Fields', 'Review & Create'];

const EMPTY_FORM = {
  name:        '',
  description: '',
  module:      '',
  format:      'EXCEL',
  dateFrom:    '',
  dateTo:      '',
  dimensions:  [],
  metrics:     [],
};

// ── Date helpers ───────────────────────────────────────────────────────────
const toDateStr = (d) => d.toISOString().split('T')[0];

const getTodayStr    = () => toDateStr(new Date());
const getOneYearAgo  = () => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return toDateStr(d);
};

// ── Helpers ────────────────────────────────────────────────────────────────
const toggle = (arr, val) =>
  arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];

// ── Sub-components ─────────────────────────────────────────────────────────
const FieldGroup = ({ title, items, selected, onChange, loading }) => (
  <Box>
    <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
      {title}
    </Typography>
    {loading ? (
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', py: 1 }}>
        <CircularProgress size={14} />
        <Typography variant="caption" color="text.secondary">Loading fields…</Typography>
      </Box>
    ) : items.length === 0 ? (
      <Typography variant="caption" color="text.secondary">
        Select a module first
      </Typography>
    ) : (
      <FormGroup row>
        {items.map(({ key, label }) => (
          <FormControlLabel
            key={key}
            control={
              <Checkbox
                size="small"
                checked={selected.includes(key)}
                onChange={() => onChange(key)}
              />
            }
            label={<Typography variant="body2">{label}</Typography>}
            sx={{ width: '50%', minWidth: 160, mr: 0 }}
          />
        ))}
      </FormGroup>
    )}
  </Box>
);

const ReviewRow = ({ label, value }) => (
  <Box sx={{ display: 'flex', gap: 2, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120, fontWeight: 500 }}>
      {label}
    </Typography>
    <Typography variant="body2">{value || <em style={{ opacity: 0.5 }}>—</em>}</Typography>
  </Box>
);

// ── Main Component ─────────────────────────────────────────────────────────
const CreateReportWizard = ({ open, onClose, onCreated }) => {
  const [step,          setStep]          = useState(0);
  const [form,          setForm]          = useState(EMPTY_FORM);
  const [fields,        setFields]        = useState({ dimensions: [], metrics: [] });
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState(null);

  // ── Field Discovery ────────────────────────────────────────────────────
  const fetchFields = useCallback(async (module) => {
    if (!module) return;
    setFieldsLoading(true);
    try {
      const res = await getModuleFieldsApi(module);
      setFields({
        dimensions: res.data?.data?.dimensions || [],
        metrics:    res.data?.data?.metrics    || [],
      });
    } catch (_) {
      setFields({ dimensions: [], metrics: [] });
    } finally {
      setFieldsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (form.module) fetchFields(form.module);
  }, [form.module, fetchFields]);

  // ── Handlers ───────────────────────────────────────────────────────────
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const handleModuleChange = (e) => {
    setForm((f) => ({ ...f, module: e.target.value, dimensions: [], metrics: [] }));
    setFields({ dimensions: [], metrics: [] });
  };

  const handleFormatChange = (_e, val) => {
    if (val) setForm((f) => ({ ...f, format: val }));
  };

  const toggleDim = (key) =>
    setForm((f) => ({ ...f, dimensions: toggle(f.dimensions, key) }));

  const toggleMetric = (key) =>
    setForm((f) => ({ ...f, metrics: toggle(f.metrics, key) }));

  // ── Validation ──────────────────────────────────────────────────────────
  const step1Valid = form.name.trim() && form.module;

  const handleNext = () => {
    if (step === 0 && !step1Valid) {
      setError('Report Name and Module are required.');
      return;
    }
    if (step === 1) {
      const today      = getTodayStr();
      const oneYearAgo = getOneYearAgo();
      if (form.dateFrom && form.dateFrom < oneYearAgo) {
        setError('From date cannot be more than 1 year in the past.');
        return;
      }
      if (form.dateTo && form.dateTo > today) {
        setError('To date cannot be a future date.');
        return;
      }
      if (form.dateFrom && form.dateTo && form.dateFrom > form.dateTo) {
        setError('From date must not be later than To date.');
        return;
      }
    }
    setError(null);
    setStep((s) => s + 1);
  };

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name:         form.name.trim(),
        description:  form.description.trim() || undefined,
        module:       form.module,
        format:       form.format,
        dateFrom:     form.dateFrom || undefined,
        dateTo:       form.dateTo   || undefined,
        dimensions:   form.dimensions,
        metrics:      form.metrics,
        extraFilters: {},
      };
      const res = await createReportApi(payload);
      onCreated(res.data?.data);
      handleClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create report.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStep(0);
    setForm(EMPTY_FORM);
    setFields({ dimensions: [], metrics: [] });
    setError(null);
    onClose();
  };

  // ── Labels ─────────────────────────────────────────────────────────────
  const moduleLabel  = MODULES.find((m) => m.value === form.module)?.label || '—';
  const dimLabels    = fields.dimensions.filter((d) => form.dimensions.includes(d.key)).map((d) => d.label);
  const metricLabels = fields.metrics.filter((m) => form.metrics.includes(m.key)).map((m) => m.label);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        New Report
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
          Step {step + 1} of {STEPS.length} — {STEPS[step]}
        </Typography>
      </DialogTitle>

      <DialogContent dividers sx={{ px: 3, py: 2 }}>
        {/* Stepper */}
        <Stepper activeStep={step} sx={{ mb: 3 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* ── Step 1: Basic Info ──────────────────────────────────────── */}
        {step === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Report Name"
              required
              fullWidth
              size="small"
              value={form.name}
              onChange={set('name')}
              placeholder="e.g. CAPA Status Summary Q1 2026"
            />
            <TextField
              label="Description (optional)"
              fullWidth
              size="small"
              multiline
              rows={2}
              value={form.description}
              onChange={set('description')}
              placeholder="Brief description of what this report covers"
            />
            <TextField
              select
              label="Module"
              required
              fullWidth
              size="small"
              value={form.module}
              onChange={handleModuleChange}
            >
              <MenuItem value="" disabled>Select a module…</MenuItem>
              {MODULES.map((m) => (
                <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
              ))}
            </TextField>

            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Export Format
              </Typography>
              <ToggleButtonGroup
                exclusive
                value={form.format}
                onChange={handleFormatChange}
                size="small"
              >
                <ToggleButton value="EXCEL" sx={{ px: 3, gap: 0.75 }}>
                  <ExcelIcon fontSize="small" /> EXCEL
                </ToggleButton>
                <ToggleButton value="CSV" sx={{ px: 3, gap: 0.75 }}>
                  <CsvIcon fontSize="small" /> CSV
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>
        )}

        {/* ── Step 2: Date & Fields ───────────────────────────────────── */}
        {step === 1 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Date From"
                  type="date"
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  inputProps={{
                    min: getOneYearAgo(),
                    max: form.dateTo || getTodayStr(),
                  }}
                  value={form.dateFrom}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm((f) => ({
                      ...f,
                      dateFrom: val,
                      // if existing dateTo is now before new dateFrom, clear it
                      dateTo: f.dateTo && f.dateTo < val ? '' : f.dateTo,
                    }));
                  }}
                  helperText={`Min: up to 1 year ago`}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Date To"
                  type="date"
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  inputProps={{
                    min: form.dateFrom || getOneYearAgo(),
                    max: getTodayStr(),
                  }}
                  value={form.dateTo}
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm((f) => ({
                      ...f,
                      dateTo: val,
                      // if existing dateFrom is now after new dateTo, clear it
                      dateFrom: f.dateFrom && f.dateFrom > val ? '' : f.dateFrom,
                    }));
                  }}
                  helperText={`Max: today`}
                />
              </Grid>
            </Grid>

            <Paper
              variant="outlined"
              sx={{
                display: 'flex', gap: 1, p: 1.25, borderRadius: 1,
                bgcolor: 'info.50', borderColor: 'info.200',
              }}
            >
              <InfoIcon fontSize="small" color="info" sx={{ mt: '1px', flexShrink: 0 }} />
              <Typography variant="caption" color="info.dark" lineHeight={1.5}>
                <strong>Grouped mode:</strong> select one or more Dimensions to get one row per
                unique combination + Count. <strong>Detail mode:</strong> leave Dimensions empty
                to get one row per record with all selected Metric columns.
              </Typography>
            </Paper>

            <Divider />

            <FieldGroup
              title="Dimensions (group by)"
              items={fields.dimensions}
              selected={form.dimensions}
              onChange={toggleDim}
              loading={fieldsLoading}
            />

            <Divider />

            <FieldGroup
              title="Metrics (columns)"
              items={fields.metrics}
              selected={form.metrics}
              onChange={toggleMetric}
              loading={fieldsLoading}
            />
          </Box>
        )}

        {/* ── Step 3: Review ──────────────────────────────────────────── */}
        {step === 2 && (
          <Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1.5 }}>
              Review your report configuration
            </Typography>
            <ReviewRow label="Name"        value={form.name} />
            <ReviewRow label="Description" value={form.description} />
            <ReviewRow label="Module"      value={moduleLabel} />
            <ReviewRow label="Format"      value={form.format} />
            <ReviewRow
              label="Date Range"
              value={
                form.dateFrom || form.dateTo
                  ? `${form.dateFrom || 'Any'} → ${form.dateTo || 'Any'}`
                  : null
              }
            />
            <Box sx={{ py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>
                Dimensions
              </Typography>
              {dimLabels.length
                ? dimLabels.map((l) => <Chip key={l} label={l} size="small" sx={{ mr: 0.5, mb: 0.25 }} />)
                : <Typography variant="caption" color="text.secondary">None — detail (flat) mode</Typography>
              }
            </Box>
            <Box sx={{ py: 0.75 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500, mb: 0.5 }}>
                Metrics
              </Typography>
              {metricLabels.length
                ? metricLabels.map((l) => <Chip key={l} label={l} size="small" variant="outlined" sx={{ mr: 0.5, mb: 0.25 }} />)
                : <Typography variant="caption" color="text.secondary">None — all default columns</Typography>
              }
            </Box>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Button onClick={handleClose} disabled={saving}>Cancel</Button>
        {step > 0 && (
          <Button variant="outlined" onClick={() => { setError(null); setStep((s) => s - 1); }} disabled={saving}>
            Back
          </Button>
        )}
        {step < 2 ? (
          <Button variant="contained" onClick={handleNext}>
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : null}
          >
            {saving ? 'Creating…' : 'Create Report'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default CreateReportWizard;
