import { describe, expect, it } from 'vitest';
import {
  FOES,
  PISTOL,
  aimTime,
  clearTime,
  comfortRange,
  damage,
  hitChance,
  jamChance,
  rollAttack,
} from './combat';

describe('the rules of a fight', () => {
  it('make shots harder with distance, evasion and the dark', () => {
    const near = hitChance(50, PISTOL, 2, 0);
    expect(hitChance(50, PISTOL, 7, 0)).toBeLessThan(near);
    expect(hitChance(50, PISTOL, 2, 20)).toBeLessThan(near);
    expect(hitChance(50, PISTOL, 2, 0, 30)).toBeLessThan(near);
  });

  it('never make a shot certain or hopeless', () => {
    expect(hitChance(100, PISTOL, 0, -100)).toBe(95);
    expect(hitChance(0, PISTOL, 40, 80, 30)).toBe(5);
  });

  it('make the unskilled miss more, walk closer, aim longer and jam more', () => {
    const [novice, expert] = [20, 80];
    expect(hitChance(novice, PISTOL, 5, 10)).toBeLessThan(hitChance(expert, PISTOL, 5, 10));
    expect(comfortRange(novice, PISTOL, 10)).toBeLessThan(comfortRange(expert, PISTOL, 10));
    expect(aimTime(novice)).toBeGreaterThan(aimTime(expert));
    expect(jamChance(novice, PISTOL)).toBeGreaterThan(jamChance(expert, PISTOL));
    expect(clearTime(novice)).toBeGreaterThan(clearTime(expert));
  });

  it('keep the comfortable range within the gun’s reach', () => {
    for (const skill of [0, 50, 100]) {
      const r = comfortRange(skill, PISTOL, 0);
      expect(r).toBeGreaterThanOrEqual(1.5);
      expect(r).toBeLessThanOrEqual(PISTOL.range);
    }
  });

  it('roll crits, hits, misses and fumbles in that order', () => {
    const at = (v: number) => () => v;
    expect(rollAttack(60, 50, at(0))).toBe('crit');
    expect(rollAttack(60, 50, at(0.5))).toBe('hit');
    expect(rollAttack(60, 50, at(0.7))).toBe('miss');
    expect(rollAttack(60, 50, at(0.999))).toBe('fumble');
  });

  it('let armour soak plain hits but not crits', () => {
    const glass = FOES.crawler.armour;
    const low = () => 0;
    expect(damage(PISTOL, glass, false, low)).toBeLessThan(PISTOL.dmg[0]);
    expect(damage(PISTOL, glass, true, low)).toBeGreaterThan(PISTOL.dmg[0]);
  });

  it('have five different enemies', () => {
    const kinds = Object.values(FOES);
    expect(kinds).toHaveLength(5);
    // The wolf outruns you; the crawler you can walk away from.
    expect(FOES.wolf.speed).toBeGreaterThan(140);
    expect(FOES.crawler.speed).toBeLessThan(58);
  });
});
