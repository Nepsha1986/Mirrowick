import type { Dialog } from './Dialog';
import { h } from './dom';

/** Letters to the developer go by email, from the player's own mail app. */
const POST = 'nepsha1986@gmail.com';

/** The mailbox by the gate: look for letters, or write one to the developer. */
export function openMailbox(d: Dialog, onClose: () => void): void {
  const menu = () =>
    d.show(
      'Mailbox',
      null,
      [
        ['Check the mail', () => d.show('Mailbox', 'It is empty.', [['Back', menu]])],
        ['Write to the developer', write],
        ['Close', () => d.close()],
      ],
      onClose,
    );

  const write = () => {
    const text = h('textarea', {
      class: 'letter',
      rows: 5,
      maxLength: 4000,
      placeholder: 'Dear developer…',
    });
    const send = () => {
      const letter = text.value.trim();
      if (!letter) return text.focus();
      const subject = encodeURIComponent('A letter from Mirrowick');
      window.location.href = `mailto:${POST}?subject=${subject}&body=${encodeURIComponent(letter)}`;
      d.show('Mailbox', 'Your letter is ready: send it from your mail app.', [
        ['Close', () => d.close()],
      ]);
    };
    d.show('A letter to the developer', text, [
      ['Send', send],
      ['Back', menu],
    ]);
  };

  menu();
}
