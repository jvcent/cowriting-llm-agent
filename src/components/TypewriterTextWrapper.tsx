import React from "react";
import TypewriterText from "./TypewriterText";

interface TypewriterTextWrapperProps {
  text: string;
  speed?: number;
  messageId: number;
  onTypingProgress?: (progress?: any) => void;
  onTypingComplete?: () => void;
}

export default function TypewriterTextWrapper({
  text,
  speed = 50,
  messageId,
  onTypingProgress,
  onTypingComplete,
}: TypewriterTextWrapperProps) {
  return (
    <TypewriterText
      text={text}
      speed={speed}
      onCharacterTyped={onTypingProgress}
      onComplete={onTypingComplete}
    />
  );
}
