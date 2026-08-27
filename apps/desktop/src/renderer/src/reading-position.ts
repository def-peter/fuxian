import type { ReadingPosition } from '@fuxian/shared-types';

export interface HeadingOffset {
  id: string;
  top: number;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export const captureReadingPosition = (
  scrollTop: number,
  maxScroll: number,
  headings: readonly HeadingOffset[],
): ReadingPosition => {
  const nearestHeading = headings.reduce<HeadingOffset | undefined>((nearest, heading) => {
    if (!nearest) {
      return heading;
    }
    return Math.abs(heading.top - scrollTop) < Math.abs(nearest.top - scrollTop)
      ? heading
      : nearest;
  }, undefined);
  const relativeProgress = maxScroll > 0 ? clamp(scrollTop / maxScroll, 0, 1) : 0;

  return {
    ...(nearestHeading ? { headingId: nearestHeading.id } : {}),
    headingOffset: nearestHeading ? scrollTop - nearestHeading.top : 0,
    relativeProgress,
  };
};

export const resolveReadingPosition = (
  position: ReadingPosition,
  maxScroll: number,
  headings: readonly HeadingOffset[],
): number => {
  const heading = position.headingId
    ? headings.find(({ id }) => id === position.headingId)
    : undefined;
  const target = heading
    ? heading.top + position.headingOffset
    : position.relativeProgress * maxScroll;
  return clamp(target, 0, Math.max(0, maxScroll));
};
