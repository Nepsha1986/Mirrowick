import { t } from '../i18n';
import type { Dialog } from './Dialog';

/** The mailbox by the gate: the one letter waiting for Victor, which `read` holds up to read. */
export function openMailbox(d: Dialog, onClose: () => void, read: () => void): void {
  const w = t().mailbox;
  d.show(
    w.title,
    w.letter,
    [
      [
        w.read,
        () => {
          d.close();
          read();
        },
      ],
      [w.close, () => d.close()],
    ],
    onClose,
  );
}
