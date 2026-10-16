import type { Dialog } from './Dialog';
import { h } from './dom';

/** Letters to the developer arrive as issues in the game's repository. */
const POST = 'https://github.com/Nepsha1986/Mirrowick/issues/new';

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
      const url = new URL(POST);
      url.searchParams.set('title', 'A letter from Mirrowick');
      url.searchParams.set('body', letter);
      window.open(url, '_blank', 'noopener');
      d.show('Mailbox', 'Your letter is ready: finish sending it on GitHub, in the new tab.', [
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
