import { expect, it } from 'vitest';
import baseline from './fixtures/tags-1.0.40.json';
import { parseTaskLine } from '../src/core/parser.ts';
import { updateLineTextAndTags } from '../src/core/lineOps.ts';

it.each(baseline.fixtures.filter(fixture => 'edit' in fixture))('preserves non-leading OPEN context tags from 1.0.40: $raw', fixture => {
  const { explicitQuadrant, ...parsed } = parseTaskLine(fixture.raw, 0)!;
  expect(explicitQuadrant).toBeUndefined();
  expect(JSON.parse(JSON.stringify(parsed))).toEqual(fixture.parsed);
  expect(updateLineTextAndTags(fixture.raw, 'Edited', parsed.contextTags)).toEqual(fixture.edit);
});
