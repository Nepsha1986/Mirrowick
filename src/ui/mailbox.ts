import { tr } from '../i18n';
import type { Dialog } from './Dialog';
import { h } from './dom';

/** Letters to the developer go by email, from the player's own mail app. */
const POST = 'nepsha1986@gmail.com';

/**
 * The mailbox by the gate: the one letter waiting for Victor, which `read`
 * holds up to read, or a letter of your own to the developer.
 */
export function openMailbox(d: Dialog, onClose: () => void, read: () => void): void {
  const mail = () =>
    d.show(
      tr('Mailbox', 'Почтовый ящик'),
      tr(
        'One letter, addressed to Victor. Nobody has collected it.',
        'Одно письмо, на имя Виктора. Его никто не забрал.',
      ),
      [
        [
          tr('Read it', 'Прочесть'),
          () => {
            d.close();
            read();
          },
        ],
        [tr('Back', 'Назад'), menu],
      ],
    );
  const menu = () =>
    d.show(
      tr('Mailbox', 'Почтовый ящик'),
      null,
      [
        [tr('Check the mail', 'Проверить почту'), mail],
        [tr('Write to the developer', 'Написать разработчику'), write],
        [tr('Close', 'Закрыть'), () => d.close()],
      ],
      onClose,
    );

  const write = () => {
    const text = h('textarea', {
      class: 'letter',
      rows: 5,
      maxLength: 4000,
      placeholder: tr('Dear developer…', 'Дорогой разработчик…'),
    });
    const send = () => {
      const letter = text.value.trim();
      if (!letter) return text.focus();
      const subject = encodeURIComponent(tr('A letter from Mirrowick', 'Письмо из Мирровика'));
      window.location.href = `mailto:${POST}?subject=${subject}&body=${encodeURIComponent(letter)}`;
      d.show(
        tr('Mailbox', 'Почтовый ящик'),
        tr(
          'Your letter is ready: send it from your mail app.',
          'Письмо готово: отправьте его из своей почтовой программы.',
        ),
        [[tr('Close', 'Закрыть'), () => d.close()]],
      );
    };
    d.show(tr('A letter to the developer', 'Письмо разработчику'), text, [
      [tr('Send', 'Отправить'), send],
      [tr('Back', 'Назад'), menu],
    ]);
  };

  menu();
}
