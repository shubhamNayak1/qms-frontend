import React, { useCallback, useMemo, useState } from 'react';
import ESignDialog from '../components/ESignDialog';

/**
 * useESignGuard — tiny reusable wrapper that puts an electronic
 * signature between a UI action click and the API call.
 *
 * Returns:
 *   request({ meaning, recordRef?, action }) — call from your click
 *       handler. Opens the e-sign dialog; when the user successfully
 *       re-enters their password, `action` is awaited. Any exception
 *       from `action` bubbles up to the dialog as a one-line error.
 *
 *   element — React node to render once near the top of your component.
 *       Keeps the dialog mounted; the hook manages open/close state.
 *
 * Compliance context: 21 CFR Part 11 §11.100 — every destructive
 * admin action (create / edit / disable / policy update) is signed
 * by the acting user. The server-side /api/v1/auth/e-sign call writes
 * the signature to the audit trail with user id, timestamp and the
 * `meaning` string passed in here.
 *
 * Example:
 *   const esign = useESignGuard();
 *   const save = () => esign.request({
 *     meaning: `Update TCD policy for ${moduleKey}`,
 *     recordRef: moduleKey,
 *     action: () => updateTcdPolicyApi(moduleKey, form),
 *   });
 *   ...
 *   {esign.element}
 */
const useESignGuard = () => {
  const [pending, setPending] = useState(null); // { meaning, recordRef?, action }

  const request = useCallback((cfg) => {
    if (!cfg?.action) return;
    setPending(cfg);
  }, []);

  const close = useCallback(() => setPending(null), []);

  const onSigned = useCallback(async () => {
    if (!pending) return;
    // The caller's action throws on failure; let it propagate so
    // ESignDialog surfaces the server message in-line.
    await pending.action();
    setPending(null);
  }, [pending]);

  const element = useMemo(() => (
    <ESignDialog
      open={!!pending}
      onClose={close}
      onSigned={onSigned}
      meaning={pending?.meaning}
      recordRef={pending?.recordRef}
    />
  ), [pending, close, onSigned]);

  return { request, element, isPending: !!pending };
};

export default useESignGuard;
