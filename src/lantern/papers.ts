import type { Words } from '../i18n';

/** How a paper looks: in someone's hand, typed, or printed in an old book. */
export type Hand = 'hand' | 'typed' | 'print';

/** Something to read: a note, a letter, a notebook, a book. */
export interface Paper {
  title: Words;
  hand: Hand;
  /** One page per entry; blank lines split paragraphs. */
  pages: Words[];
  /** What the hero thinks once he has read it the first time. */
  after?: Words;
}

/** Everything there is to read, by id. A thing points at one with `Thing.read`. */
export const PAPERS: Record<string, Paper> = {
  'fridge-note': {
    title: { en: 'A note on the fridge', ru: 'Записка на холодильнике' },
    hand: 'hand',
    pages: [
      {
        en: 'Milk\nBread\nBatteries, the big ones, for the flashlight!\nRing Pete about the hedge',
        ru: 'Молоко\nХлеб\nБатарейки, большие, для фонарика!\nПозвонить Питу насчёт изгороди',
      },
    ],
  },
  notebook: {
    title: { en: "Victor's notebook", ru: 'Блокнот Виктора' },
    hand: 'hand',
    pages: [
      {
        en: '2 Oct.\n\nCleared out the old shed at the bottom of the garden at last. Under the boards there was a hatch, its padlock rusted solid. Cut it off and put a new one on.\n\nSomething about it I don’t like. I’ll keep it locked.',
        ru: '2 окт.\n\nНаконец разобрал старый сарай в конце сада. Под досками нашёлся люк, замок на нём весь проржавел. Спилил, повесил новый.\n\nЧто-то мне в нём не нравится. Пусть будет заперт.',
      },
      {
        en: '9 Oct.\n\nLights again last night. Not in the shed: under it. Cold and blue, like moonlight on water.\n\nWhen I went out with the flashlight they had gone. But where I had walked, my boots left marks that glowed in the beam.',
        ru: '9 окт.\n\nНочью опять огни. Не в сарае, а под ним. Холодные, синие, как луна на воде.\n\nКогда я вышел с фонариком, их уже не было. Но там, где я прошёл, мои сапоги оставили следы, и они светились в луче.',
      },
      {
        en: '13 Oct.\n\nThere’s a room down there, bigger than the shed, bigger than the house. Candles that were lit before I came. And a mirror.\n\nTonight I go down again and look properly.',
        ru: '13 окт.\n\nТам, внизу, комната, больше сарая, больше дома. Свечи, которые горели ещё до меня. И зеркало.\n\nСегодня спущусь снова и рассмотрю как следует.',
      },
    ],
    after: {
      en: 'The shed at the bottom of the garden. Lights after dark… I should look there tonight.',
      ru: 'Сарай в конце сада. Огни после заката… Надо заглянуть туда сегодня ночью.',
    },
  },
  'bookshop-letter': {
    title: { en: 'A letter for Victor', ru: 'Письмо Виктору' },
    hand: 'typed',
    pages: [
      {
        en: 'Dear Victor,\n\nI am sorry to say I have had no luck with the book you asked after, “Of the Glass and What Lies Behind It”. The only copy I ever heard of was sold from a house out your way, long before my time.\n\nWhoever has it now, I hope they read it more carefully than its last owner.\n\nWith best wishes,\nMargaret Hollis, Hollis Books',
        ru: 'Дорогой Виктор,\n\nк сожалению, книгу, о которой вы спрашивали, «О Стекле и о том, что за ним», мне найти не удалось. Единственный экземпляр, о котором я слышала, был продан из дома где-то в ваших краях, задолго до меня.\n\nНадеюсь, кто бы ни владел ею теперь, он читает её внимательнее прежнего хозяина.\n\nС наилучшими пожеланиями,\nМаргарет Холлис, «Книги Холлис»',
      },
    ],
  },
  tome: {
    title: { en: 'Of the Glass', ru: 'О Стекле' },
    hand: 'print',
    pages: [
      {
        en: 'Every place hath its twin, as every face its reflection, and the twain share one name.\n\nWhere they lie closest, a glass may be made a door. Who passes through carrieth the light of the other side upon him for a time, and it showeth on all he treadeth.',
        ru: 'Всякое место имеет близнеца своего, как всякий лик — отражение, и оба носят единое имя.\n\nГде лежат они ближе всего, там стекло можно сотворить дверью. Кто пройдёт сквозь, тот несёт на себе свет иной стороны некое время, и являет он себя на всём, чего тот коснётся стопою.',
      },
      {
        en: 'A slip of paper tucked between the pages, in Victor’s hand:\n\nGoing through. Back before morning.\n— V.',
        ru: 'Между страниц — листок, рукой Виктора:\n\nИду туда. Вернусь до утра.\n— В.',
      },
    ],
    after: {
      en: 'He went through the mirror. Into whatever is behind it.',
      ru: 'Он ушёл через зеркало. Туда, что бы там ни было.',
    },
  },
};
