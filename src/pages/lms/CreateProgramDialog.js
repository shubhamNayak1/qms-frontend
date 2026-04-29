import React, { useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, MenuItem, Switch, FormControlLabel,
  Grid, Typography, Box, Divider, Alert, CircularProgress,
} from '@mui/material';
import { createProgramApi } from '../../api/lmsApi';

const F = ({ label, name, form, setForm, ...rest }) => (
  <TextField
    label={label}
    size="small"
    fullWidth
    value={form[name] ?? ''}
    onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))}
    {...rest}
  />
);

const SectionLabel = ({ children }) => (
  <Typography variant="caption" fontWeight={700} color="text.secondary"
    sx={{ display: 'block', mt: 2, mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
    {children}
  </Typography>
);

const INITIAL = {
  code: '', title: '', description: '', trainingType: 'SCHEDULED', trainingSubType: 'REGULAR',
  category: '', department: '', departments: '', tags: '',
  isMandatory: false,
  trainerName: '', vendorName: '', coordinatorName: '',
  location: '', conferenceLink: '',
  examEnabled: false, assessmentRequired: false,
  passScore: 80, maxAttempts: 3,
  estimatedDurationMinutes: 60, certificateValidityYears: 2, completionDeadlineDays: 30,
};

const CreateProgramDialog = ({ open, onClose, onCreated }) => {
  const [form,    setForm]    = useState(INITIAL);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState(null);

  const handleClose = () => { setForm(INITIAL); setError(null); onClose(); };

  const handleSave = async () => {
    if (!form.code || !form.title || !form.trainingType) {
      setError('Code, Title and Training Type are required.');
      return;
    }
    setSaving(true); setError(null);
    try {
      await createProgramApi({
        ...form,
        passScore:                 form.examEnabled ? Number(form.passScore)                 : undefined,
        maxAttempts:               form.examEnabled ? Number(form.maxAttempts)               : undefined,
        estimatedDurationMinutes:  Number(form.estimatedDurationMinutes)  || undefined,
        certificateValidityYears:  Number(form.certificateValidityYears)  || undefined,
        completionDeadlineDays:    Number(form.completionDeadlineDays)    || undefined,
      });
      onCreated();
      handleClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create program.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Create Training Program</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* ── Basic Info ── */}
        <SectionLabel>Program Info</SectionLabel>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={3}>
            <F label="Program Code *" name="code" form={form} setForm={setForm} inputProps={{ style: { fontFamily: 'monospace' } }} />
          </Grid>
          <Grid item xs={12} sm={9}>
            <F label="Title *" name="title" form={form} setForm={setForm} />
          </Grid>
          <Grid item xs={12}>
            <F label="Description" name="description" form={form} setForm={setForm} multiline rows={2} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="Training Type *" select size="small" fullWidth value={form.trainingType}
              onChange={(e) => setForm((p) => ({ ...p, trainingType: e.target.value }))}>
              <MenuItem value="SCHEDULED">Scheduled</MenuItem>
              <MenuItem value="SELF">Self-Paced</MenuItem>
              <MenuItem value="INDUCTION">Induction</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField label="Sub-Type" select size="small" fullWidth value={form.trainingSubType}
              onChange={(e) => setForm((p) => ({ ...p, trainingSubType: e.target.value }))}>
              <MenuItem value="REGULAR">Regular</MenuItem>
              <MenuItem value="REFRESHER">Refresher</MenuItem>
              <MenuItem value="TEMPORARY">Temporary</MenuItem>
              <MenuItem value="OJT">OJT (On-the-Job)</MenuItem>
            </TextField>
          </Grid>
          <Grid item xs={12} sm={4}>
            <F label="Category" name="category" form={form} setForm={setForm} />
          </Grid>
          {form.trainingType === 'INDUCTION' ? (
            <Grid item xs={12}>
              <F label="Departments (comma-separated)" name="departments" form={form} setForm={setForm}
                helperText="e.g. Production,QA,Warehouse" />
            </Grid>
          ) : (
            <Grid item xs={12} sm={6}>
              <F label="Department" name="department" form={form} setForm={setForm} />
            </Grid>
          )}
          <Grid item xs={12} sm={form.trainingType === 'INDUCTION' ? 12 : 6}>
            <F label="Tags (comma-separated)" name="tags" form={form} setForm={setForm} />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={<Switch checked={form.isMandatory} onChange={(e) => setForm((p) => ({ ...p, isMandatory: e.target.checked }))} color="warning" />}
              label={<Typography variant="body2" fontWeight={600}>Mandatory Training</Typography>}
            />
          </Grid>
        </Grid>

        <Divider sx={{ my: 1.5 }} />

        {/* ── Trainer & Schedule ── */}
        <SectionLabel>Trainer &amp; Location</SectionLabel>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={4}>
            <F label="Internal Trainer Name" name="trainerName" form={form} setForm={setForm} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <F label="External Vendor Name" name="vendorName" form={form} setForm={setForm} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <F label="Coordinator Name" name="coordinatorName" form={form} setForm={setForm} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <F label="Location / Venue" name="location" form={form} setForm={setForm} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <F label="Conference / Meeting Link" name="conferenceLink" form={form} setForm={setForm} />
          </Grid>
        </Grid>

        <Divider sx={{ my: 1.5 }} />

        {/* ── Exam & Validity ── */}
        <SectionLabel>Exam &amp; Settings</SectionLabel>
        <Grid container spacing={1.5}>
          <Grid item xs={12} sm={4}>
            <F label="Duration (minutes)" name="estimatedDurationMinutes" form={form} setForm={setForm} type="number" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <F label="Certificate Validity (years)" name="certificateValidityYears" form={form} setForm={setForm} type="number" />
          </Grid>
          <Grid item xs={12} sm={4}>
            <F label="Completion Deadline (days)" name="completionDeadlineDays" form={form} setForm={setForm} type="number" />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={<Switch checked={form.examEnabled} onChange={(e) => setForm((p) => ({ ...p, examEnabled: e.target.checked }))} color="primary" />}
              label={<Typography variant="body2" fontWeight={600}>Enable Exam / Assessment</Typography>}
            />
          </Grid>
          {form.examEnabled && (
            <>
              <Grid item xs={12} sm={4}>
                <F label="Pass Score (%)" name="passScore" form={form} setForm={setForm} type="number" inputProps={{ min: 0, max: 100 }} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <F label="Max Attempts" name="maxAttempts" form={form} setForm={setForm} type="number" inputProps={{ min: 1 }} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ display: 'flex', alignItems: 'center', height: '100%', pt: 0.5 }}>
                  <FormControlLabel
                    control={<Switch checked={form.assessmentRequired} onChange={(e) => setForm((p) => ({ ...p, assessmentRequired: e.target.checked }))} />}
                    label={<Typography variant="body2">Assessment Required</Typography>}
                  />
                </Box>
              </Grid>
            </>
          )}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : null}>
          {saving ? 'Creating…' : 'Create Program'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateProgramDialog;
