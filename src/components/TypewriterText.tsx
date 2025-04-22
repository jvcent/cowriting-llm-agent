import React, { useState, useEffect, useRef } from "react";

interface TypewriterTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  onCharacterTyped?: () => void;
}

export default function TypewriterText({
  text,
  speed = 30,
  onComplete,
  onCharacterTyped,
}: TypewriterTextProps) {
  const [displayText, setDisplayText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  // Use refs to handle animation state
  const animationRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const chunkIndexRef = useRef(0);

  // Store the original text to prevent animation restarts
  const textRef = useRef(text);

  // Split the text into chunks properly
  const chunksRef = useRef<string[]>([]);

  // Create natural, LLM-like chunks that preserve coherence
  const createNaturalChunks = (text: string): string[] => {
    // First, create a token-by-token representation
    // This simulates how an LLM would actually generate text
    const words = text.split(/(\s+)/);
    const chunks: string[] = [];

    // Begin with reasonable chunk size (can be adjusted)
    let currentChunkSize = 1;
    let currentChunk = "";
    let wordIndex = 0;

    while (wordIndex < words.length) {
      // Determine how many words to include in this burst
      // This creates a natural rhythm of faster/slower generation
      if (wordIndex > 0 && wordIndex % 15 === 0) {
        // Occasionally pause briefly at natural boundaries by creating a small chunk
        currentChunkSize = 1;
      } else {
        // Vary the chunk size to simulate natural generation rhythm
        // LLMs sometimes generate a burst of words, then slow down at complex points
        currentChunkSize = Math.floor(Math.random() * 4) + 1;
      }

      // Build the current chunk
      currentChunk += words[wordIndex];

      // If the current chunk is full, add it to the chunks array
      if (currentChunk.length >= currentChunkSize) {
        chunks.push(currentChunk);
        currentChunk = "";
      }

      wordIndex++;
    }

    // If there's any remaining text, add it as the last chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  };

  useEffect(() => {
    // Move startAnimation inside useEffect
    const startAnimation = () => {
      let lastTime = performance.now();

      const animate = (time: number) => {
        if (!isMountedRef.current) return;

        const elapsed = time - lastTime;

        const chunk = chunksRef.current[chunkIndexRef.current] || "";
        const chunkLength = chunk.length;

        const randomFactor = Math.random() * 0.5 + 0.5;
        const baseInterval = Math.max(20, 100 - speed * 2);
        const interval =
          baseInterval * randomFactor * (chunkLength > 15 ? 1.2 : 0.8);

        if (elapsed > interval) {
          lastTime = time;

          if (chunkIndexRef.current < chunksRef.current.length) {
            const nextChunk = chunksRef.current[chunkIndexRef.current];
            setDisplayText((prev) => prev + nextChunk);
            chunkIndexRef.current++;

            if (onCharacterTyped) {
              onCharacterTyped();
            }
          } else if (!isComplete) {
            setIsComplete(true);
            if (onComplete) {
              onComplete();
            }
            return;
          }
        }

        animationRef.current = requestAnimationFrame(animate);
      };

      animationRef.current = requestAnimationFrame(animate);
    };

    textRef.current = text;
    chunksRef.current = createNaturalChunks(text);
    isMountedRef.current = true;
    chunkIndexRef.current = 0;
    setDisplayText("");
    setIsComplete(false);

    startAnimation();

    return () => {
      isMountedRef.current = false;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [text, speed, onComplete, onCharacterTyped, isComplete]);

  return <div className="whitespace-pre-wrap">{displayText}</div>;
}
