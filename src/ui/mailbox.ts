import { t } from '../i18n';
import type { Dialog } from './Dialog';
import { h } from './dom';

/** Letters to the developer go by email, from the player's own mail app. */
const POST = 'nepsha1986@gmail.com';

/**
 * The mailbox by the gate: the one letter waiting for Victor, which `read`
 * holds up to read, or a letter of your own to the developer.
 */
export function openMailbox(d: Dialog, onClose: () => void, read: () => void): void {
  const w = t().mailbox;
  const mail = () =>
    d.show(w.title, w.letter, [
      [
        w.read,
        () => {
          d.close();
          read();
        },
      ],
      [w.back, menu],
    ]);
  const menu = () =>
    d.show(
      w.title,
      null,
      [
        [w.check, mail],
        [w.write, write],
        [w.close, () => d.close()],
      ],
      onClose,
    );

  const write = () => {
    const text = h('textarea', {
      class: 'letter',
      rows: 5,
      maxLength: 4000,
      placeholder: w.dear,
    });
    const send = () => {
      const letter = text.value.trim();
      if (!letter) return text.focus();
      const subject = encodeURIComponent(w.subject);
      window.location.href = `mailto:${POST}?subject=${subject}&body=${encodeURIComponent(letter)}`;
      d.show(w.title, w.ready, [[w.close, () => d.close()]]);
    };
    d.show(w.toDeveloper, text, [
      [w.send, send],
      [w.back, menu],
    ]);
  };

  menu();
}
