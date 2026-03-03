import { describe, test, expect } from 'bun:test';
import { createXpRewardEmbed, createDMNotificationEmbed } from '../../../src/discord/embeds';
import { COLORS, EMOJIS } from '../../../src/config';

// Mock Discord User object
function createMockDiscordUser(overrides: Partial<{
  id: string;
  username: string;
  displayAvatarURL: (options?: { size?: number }) => string;
}> = {}) {
  return {
    id: overrides.id ?? '123456789',
    username: overrides.username ?? 'testuser',
    displayAvatarURL: overrides.displayAvatarURL ?? (() => 'https://cdn.discordapp.com/avatars/123/abc.png'),
  } as any;
}

describe('createXpRewardEmbed', () => {
  const admin = createMockDiscordUser({ id: '111', username: 'admin' });
  const target = createMockDiscordUser({ id: '222', username: 'ambassador' });

  test('uses GOLD color', () => {
    const embed = createXpRewardEmbed(admin, target, 500, 1500, 'Great work');
    expect(embed.toJSON().color).toBe(COLORS.GOLD);
  });

  test('creates title with star emojis', () => {
    const embed = createXpRewardEmbed(admin, target, 100, 600, 'Bonus');
    expect(embed.toJSON().title).toBe(`${EMOJIS.STAR} ═══ XP REWARD ═══ ${EMOJIS.STAR}`);
  });

  test('includes admin and target mentions in description', () => {
    const embed = createXpRewardEmbed(admin, target, 100, 600, 'Bonus');
    const data = embed.toJSON();
    expect(data.description).toContain('<@111>');
    expect(data.description).toContain('<@222>');
    expect(data.description).toContain('awarded XP to');
  });

  test('includes reason in description', () => {
    const embed = createXpRewardEmbed(admin, target, 100, 600, 'Event participation');
    expect(embed.toJSON().description).toContain('"Event participation"');
  });

  test('shows amount with plus sign in XP Awarded field', () => {
    const embed = createXpRewardEmbed(admin, target, 500, 1500, 'Bonus');
    const data = embed.toJSON();
    const field = data.fields?.find((f) => f.name.includes('XP Awarded'));
    expect(field?.value).toContain('+500');
    expect(field?.inline).toBe(true);
  });

  test('shows new total in field', () => {
    const embed = createXpRewardEmbed(admin, target, 500, 1500, 'Bonus');
    const data = embed.toJSON();
    const field = data.fields?.find((f) => f.name.includes('New Total'));
    expect(field?.value).toContain('1,500');
    expect(field?.inline).toBe(true);
  });

  test('sets target avatar as thumbnail', () => {
    const embed = createXpRewardEmbed(admin, target, 100, 600, 'Test');
    expect(embed.toJSON().thumbnail).toBeDefined();
  });

  test('sets admin info in footer with "Awarded by"', () => {
    const embed = createXpRewardEmbed(admin, target, 100, 600, 'Test');
    expect(embed.toJSON().footer?.text).toBe('Awarded by admin');
  });

  test('includes timestamp', () => {
    const embed = createXpRewardEmbed(admin, target, 100, 600, 'Test');
    expect(embed.toJSON().timestamp).toBeDefined();
  });

  test('formats large numbers with commas', () => {
    const embed = createXpRewardEmbed(admin, target, 50000, 100000, 'Big reward');
    const data = embed.toJSON();
    const awardedField = data.fields?.find((f) => f.name.includes('XP Awarded'));
    expect(awardedField?.value).toContain('+50,000');
    const totalField = data.fields?.find((f) => f.name.includes('New Total'));
    expect(totalField?.value).toContain('100,000');
  });
});

describe('createDMNotificationEmbed', () => {
  test('creates approval embed with correct color', () => {
    const embed = createDMNotificationEmbed(true, 'Twitter Post', 'https://t.co/test', 85, 100, 25, 500);
    expect(embed.toJSON().color).toBe(COLORS.SUCCESS);
  });

  test('creates rejection embed with correct color', () => {
    const embed = createDMNotificationEmbed(false, 'Twitter Post', 'https://t.co/test', 30, 0, 0, 200);
    expect(embed.toJSON().color).toBe(COLORS.ERROR);
  });

  test('includes task name in description', () => {
    const embed = createDMNotificationEmbed(true, 'Twitter Post', null, 85, 100, 0, 500);
    expect(embed.toJSON().description).toContain('Twitter Post');
  });

  test('includes URL when provided', () => {
    const embed = createDMNotificationEmbed(true, 'Twitter Post', 'https://t.co/test', 85, 100, 0, 500);
    expect(embed.toJSON().description).toContain('https://t.co/test');
  });

  test('handles null URL', () => {
    const embed = createDMNotificationEmbed(true, 'Twitter Post', null, 85, 100, 0, 500);
    expect(embed.toJSON().description).not.toContain('null');
  });

  test('shows quality score in fields', () => {
    const embed = createDMNotificationEmbed(true, 'Twitter Post', null, 85, 100, 0, 500);
    const data = embed.toJSON();
    const fieldValues = data.fields?.map((f) => f.value).join(' ');
    expect(fieldValues).toContain('85%');
  });

  test('shows bonus XP when provided', () => {
    const embed = createDMNotificationEmbed(true, 'Twitter Post', null, 85, 100, 25, 625);
    const data = embed.toJSON();
    const fieldValues = data.fields?.map((f) => f.value).join(' ');
    expect(fieldValues).toContain('+25');
  });

  test('shows total XP', () => {
    const embed = createDMNotificationEmbed(true, 'Twitter Post', null, 85, 100, 0, 500);
    const data = embed.toJSON();
    const fieldValues = data.fields?.map((f) => f.value).join(' ');
    expect(fieldValues).toContain('500');
  });

  test('includes reviewer notes when provided', () => {
    const embed = createDMNotificationEmbed(false, 'Twitter Post', null, 30, 0, 0, 200, 'Needs more engagement');
    const data = embed.toJSON();
    const fieldValues = data.fields?.map((f) => f.value).join(' ');
    expect(fieldValues).toContain('Needs more engagement');
  });

  test('approval title contains "Approved"', () => {
    const embed = createDMNotificationEmbed(true, 'Task', null, 80, 100, 0, 500);
    expect(embed.toJSON().title).toContain('Approved');
  });

  test('rejection title contains "Rejected"', () => {
    const embed = createDMNotificationEmbed(false, 'Task', null, 30, 0, 0, 200);
    expect(embed.toJSON().title).toContain('Rejected');
  });
});
