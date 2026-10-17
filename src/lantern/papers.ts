/** How a paper looks: in someone's hand, typed, or printed in an old book. */
export type Hand = 'hand' | 'typed' | 'print';

/** Something to read: a note, a letter, a notebook, a book. */
export interface Paper {
  title: string;
  hand: Hand;
  /** One page per string; blank lines split paragraphs. */
  pages: string[];
  /** What the hero thinks once he has read it the first time. */
  after?: string;
}

/** Everything there is to read, by id. A thing points at one with `Thing.read`. */
export const PAPERS: Record<string, Paper> = {
  'fridge-note': {
    title: 'A note on the fridge',
    hand: 'hand',
    pages: ['Milk\nBread\nBatteries, the big ones, for the flashlight!\nRing Pete about the hedge'],
  },
  notebook: {
    title: "Victor's notebook",
    hand: 'hand',
    pages: [
      '2 Oct.\n\nCleared out the old shed at the bottom of the garden at last. Under the boards there was a hatch, its padlock rusted solid. Cut it off and put a new one on.\n\nSomething about it I don’t like. I’ll keep it locked.',
      '9 Oct.\n\nLights again last night. Not in the shed: under it. Cold and blue, like moonlight on water.\n\nWhen I went out with the flashlight they had gone. But where I had walked, my boots left marks that glowed in the beam.',
      '13 Oct.\n\nThere’s a room down there, bigger than the shed, bigger than the house. Candles that were lit before I came. And a mirror.\n\nTonight I go down again and look properly.',
    ],
    after: 'The shed at the bottom of the garden. Lights after dark… I should look there tonight.',
  },
  'bookshop-letter': {
    title: 'A letter for Victor',
    hand: 'typed',
    pages: [
      'Dear Victor,\n\nI am sorry to say I have had no luck with the book you asked after, “Of the Glass and What Lies Behind It”. The only copy I ever heard of was sold from a house out your way, long before my time.\n\nWhoever has it now, I hope they read it more carefully than its last owner.\n\nWith best wishes,\nMargaret Hollis, Hollis Books',
    ],
  },
  tome: {
    title: 'Of the Glass',
    hand: 'print',
    pages: [
      'Every place hath its twin, as every face its reflection, and the twain share one name.\n\nWhere they lie closest, a glass may be made a door. Who passes through carrieth the light of the other side upon him for a time, and it showeth on all he treadeth.',
      'A slip of paper tucked between the pages, in Victor’s hand:\n\nGoing through. Back before morning.\n— V.',
    ],
    after: 'He went through the mirror. Into whatever is behind it.',
  },
};
