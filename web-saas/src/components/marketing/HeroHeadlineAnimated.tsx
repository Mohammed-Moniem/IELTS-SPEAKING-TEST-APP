'use client';

import React from 'react';

type HeroHeadlineAnimatedProps = {
  textParts: string[];
  keyphrase?: string;
  enabled?: boolean;
  className?: string;
};

const KEYPHRASE_STYLE =
  'bg-gradient-to-r from-white via-violet-100 to-fuchsia-100 bg-clip-text text-transparent';

const renderKeyphrase = (line: string, keyphrase: string, enabled: boolean) => {
  const index = line.toLowerCase().indexOf(keyphrase.toLowerCase());
  if (index < 0) return line;

  const start = line.slice(0, index);
  const match = line.slice(index, index + keyphrase.length);
  const end = line.slice(index + keyphrase.length);

  return (
    <>
      {start}
      <span className={`${KEYPHRASE_STYLE} ${enabled ? 'motion-hero-keyphrase' : ''}`}>{match}</span>
      {end}
    </>
  );
};

export function HeroHeadlineAnimated({
  textParts,
  keyphrase,
  enabled = true,
  className = ''
}: HeroHeadlineAnimatedProps) {
  return (
    <h1 className={className}>
      {textParts.map((line, index) => (
        <span
          key={`${line}-${index}`}
          className={`block ${enabled ? 'motion-hero-line' : ''}`}
          style={enabled ? { animationDelay: `${40 + index * 140}ms` } : undefined}
        >
          {keyphrase ? renderKeyphrase(line, keyphrase, enabled) : line}
        </span>
      ))}
    </h1>
  );
}
