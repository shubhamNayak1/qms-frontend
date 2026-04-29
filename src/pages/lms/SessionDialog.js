import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Grid, Alert, CircularProgress,
} from '@mui/material';
import { createSessionApi, updateSessionApi } from '../../api/lmsApi';

const INITIAL = {
  sessionDate: '', sessionEndDate: '', startTime: '09:00', endTime: '17:00',
  venue: '', meetingLink: '', trainerName: '', coordinatorName: '',
  maxParticipants: '', notes: '',
};

const F = ({ label, name, form, setForm, ...rest }) => (
  <TextField
    label={label} size="small" fullWidth
    value={form[name] ?? ''}
    onChange={(e) => setForm((p) => ({ ...p, [name]: e.target.value }))}
    {...rest}
  />
);

const SessionDialog = ({ open, onClose, onSaved, programId, session }) => {
  const [form,   setForm]   = useState(INITIAL);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  useEffect(() => {
    if (session) {
      setForm({
        sessionDate:     session.sessionDate     || '',
        sessionEndDate:  session.sessionEndDate  || '',
        startTime:       session.startTime       || '09:00',
        endTime:         session.endTime         || '17:00',
        venue:           session.venue           || '',
        meetingLink:     session.meetingLink     || '',
        trainerName:     session.trainerName     || '',
        coordinatorName: session.coordinatorName || '',
        maxParticipants: session.maxParticipants || '',
        notes:           session.notes           || '',
      });
    } else {
      setForm(INITIAL);
    }
    setError(null);
  }, [session, open]);

  const handleSave = async () => {
    if (!form.sessionDate) { setError('Session date is required.'); return; }
    setSaving(true); setError(null);
    try {
      const payload = { ...form, maxParticipants: form.maxParticipants ? Number(form.maxParticipants) : undefined };
      if (session?.id) {
        await updateSessionApi(session.id, payload);
      } else {
        await createSessionApi(programId, payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save session.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{session ? 'Edit Session' : 'Add Session'}</DialogTitle>
      <DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Grid container spacing={1.5} sx={{ pt: 0.5 }}>
          <Grid item xs={12} sm={6}>
            <F label="Session Date *" name="sessionDate" form={form} setForm={setForm} type="date" InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <F label="End Date (multi-day)" name="sessionEndDate" form={form} setForm={setForm} type="date" InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={6}>
            <F label="Start Time" name="startTime" form={form} setForm={setForm} type="time" InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={6}>
            <F label="End Time" name="endTime" form={form} setForm={setForm} type="time" InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <F label="Venue" name="venue" form={form} setForm={setForm} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <F label="Meeting Link" name="meetingLink" form={form} setForm={setForm} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <F label="Trainer Name" name="trainerName" form={form} setForm={setForm} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <F label="Coordinator Name" name="coordinatorName" form={form} setForm={setForm} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <F label="Max Participants" name="maxParticipants" form={form} setForm={setForm} type="number" />
          </Grid>
          <Grid item xs={12} sm={8}>
            <F label="Notes" name="notes" form={form} setForm={setForm} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : null}>
          {saving ? 'Saving…' : (session ? 'Update' : 'Add Session')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SessionDialog;
