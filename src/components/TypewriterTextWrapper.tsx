import React from "react";
import TypewriterText from "./TypewriterText";

interface TypewriterTextWrapperProps {
  text: string;
  speed?: number;
  onTypingProgress?: (progress: number) => void;
  onTypingComplete?: () => void;
}

export default function TypewriterTextWrapper({
  text,
  speed = 50,
  onTypingProgress,
  onTypingComplete,
}: TypewriterTextWrapperProps) {
  return (
    <TypewriterText
      text={text}
      speed={speed}
      onCharacterTyped={() => onTypingProgress?.(0)}
      onComplete={onTypingComplete}
    />
  );
}
