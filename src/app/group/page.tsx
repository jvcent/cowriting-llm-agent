"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import TypewriterText from "@/components/TypewriterText";
import { aiService, AI_MODELS } from "@/services/AI";
import { Message } from "@/utils/types";
import TypewriterTextWrapper from "@/components/TypewriterTextWrapper";
import { creativeTopics } from "@/data/creative";
import { argumentativeTopics } from "@/data/argumentative";

export default function GroupPeerPage() {
  const router = useRouter();

  // State management
  const [messages, setMessages] = useState<Message[]>([]);
  const [completedMessageIds, setCompletedMessageIds] = useState<number[]>([]);
  const [scratchboardContent, setScratchboardContent] = useState("");
  const [input, setInput] = useState("");
  const [finalAnswer, setFinalAnswer] = useState("");
  const [nextMessageId, setNextMessageId] = useState(3);
  const [typingMessageIds, setTypingMessageIds] = useState<number[]>([]);
  const [isQuestioningEnabled, setIsQuestioningEnabled] = useState(true);
  const [evaluationComplete, setEvaluationComplete] = useState(false);
  const [botThinking, setBotThinking] = useState(false);
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const [currentModel] = useState(AI_MODELS.CLAUDE_HAIKU.id);
  const [lastUserActivityTime, setLastUserActivityTime] = useState(Date.now());

  // Questions from JSON
  const [allQuestions, setAllQuestions] = useState<string[]>([]);
  const [loadedQuestions, setLoadedQuestions] = useState(false);

  // Timer state
  const timerDuration = 5;
  const [timeLeft, setTimeLeft] = useState(timerDuration);
  const roundEndedRef = useRef(false);

  // Question tracking
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [usedQuestionIndices, setUsedQuestionIndices] = useState<number[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);

  // Add these new state variables and refs at the top of the component
  const [lastProcessedWordCount, setLastProcessedWordCount] = useState(0);
  const [isFeedbackInProgress, setIsFeedbackInProgress] = useState(false);
  const WORDS_THRESHOLD = 35;

  // Add these state variables at the top of your component
  const [currentPromptType, setCurrentPromptType] = useState<
    "creative" | "argumentative"
  >("creative");
  const [currentPrompt, setCurrentPrompt] = useState<string>("");

  // Add a new state to track when we should navigate
  const [shouldNavigate, setShouldNavigate] = useState(false);

  // Add new state variables
  const [currentRound, setCurrentRound] = useState(0); // 0 = first prompt, 1 = second prompt, 2 = break

  // Add helper function to get agents for a prompt
  const getAgentsForPrompt = (
    prompt: string,
    type: "creative" | "argumentative"
  ) => {
    if (type === "creative") {
      return creativeTopics[prompt] || [];
    } else {
      return argumentativeTopics[prompt] || [];
    }
  };

  // Add agents state
  const [agents, setAgents] = useState<any[]>([]);

  // Load questions from JSON file
  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const response = await fetch("/questions.json");
        if (!response.ok) {
          throw new Error("Failed to fetch questions");
        }

        const data = await response.json();

        // Flatten all categories into a single array of questions
        const questions: string[] = Object.values(data).flat() as string[];

        setAllQuestions(questions);
        setLoadedQuestions(true);
        console.log("Loaded questions:", questions);
      } catch (error) {
        console.error("Error loading questions:", error);
        // Use fallback questions if we can't load from JSON
        setAllQuestions([
          "In how many ways can four couples be seated at a round table if the men and women want to sit alternately?",
          "In how many different ways can five people be seated at a circular table?",
          "A shopping mall has a straight row of 5 flagpoles at its main entrance plaza. It has 3 identical green flags and 2 identical yellow flags. How many distinct arrangements of flags on the flagpoles are possible?",
        ]);
        setLoadedQuestions(true);
      }
    };

    fetchQuestions();
  }, []);

  // Add this at the top of your component with other state declarations
  const nextMessageIdRef = useRef(3); // Start at 3 to match your initial state

  // Replace your existing getUniqueMessageId function with this:
  const getUniqueMessageId = () => {
    const id = nextMessageIdRef.current;
    nextMessageIdRef.current += 1;

    // Keep the state in sync for display purposes only (not for generating IDs)
    setNextMessageId(nextMessageIdRef.current);

    return id;
  };

  // Add this helper function to use throughout your code
  const ensureNoTypingInProgress = (callback: () => void, maxDelay = 10000) => {
    const startTime = Date.now();

    const tryCallback = () => {
      // Safety timeout to prevent infinite waiting
      if (Date.now() - startTime > maxDelay) {
        console.warn(
          "Timeout waiting for typing to complete, proceeding anyway"
        );
        callback();
        return;
      }

      if (typingMessageIds.length > 0) {
        console.log(
          `Messages still typing: ${typingMessageIds.join(
            ", "
          )}, delaying action`
        );
        setTimeout(tryCallback, 800);
        return;
      }

      // No typing in progress, safe to proceed
      console.log("No typing in progress, proceeding with action");
      callback();
    };

    tryCallback();
  };

  // Add a new ref to track manual scroll state for the current message
  const currentMessageScrollOverrideRef = useRef(false);

  // Add a ref to track the last manual scroll time
  const lastManualScrollTimeRef = useRef(0);

  // Add a ref to track if we should force scroll on next render
  const forceScrollToBottomRef = useRef(false);

  // Add a ref to specifically track manual scroll override during generation
  const manualScrollOverrideRef = useRef(false);

  // Improve the scrollToBottom function to respect manual override
  const scrollToBottom = (force = false) => {
    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;

    // Never scroll if manual override is active, except for forced user messages
    if (manualScrollOverrideRef.current && !force) {
      return;
    }

    // Always scroll if force is true (used for user messages) or auto-scroll is active
    if (force || forceScrollToBottomRef.current || !userHasScrolled) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
      // Reset force flag after using it
      forceScrollToBottomRef.current = false;
    }
  };

  // Update the scroll handler to immediately set manual override
  const handleScroll = () => {
    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;

    // Check if this is a programmatic scroll (very recent auto-scroll)
    const isProgrammaticScroll =
      Date.now() - lastManualScrollTimeRef.current < 50;

    if (isProgrammaticScroll) {
      // Ignore programmatic scrolls
      return;
    }

    // More generous threshold - user only needs to scroll a small amount
    const isNearBottom =
      Math.abs(
        chatContainer.scrollHeight -
          chatContainer.scrollTop -
          chatContainer.clientHeight
      ) < 150;

    // If user scrolls up even slightly, set manual override
    if (!isNearBottom) {
      // Update regular scroll state
      setUserHasScrolled(true);

      // Set manual override that persists during generation
      manualScrollOverrideRef.current = true;

      console.log("Manual scroll detected - autoscroll disabled");
    } else {
      // If user scrolls back to bottom, they want to follow the conversation again
      setUserHasScrolled(false);
      manualScrollOverrideRef.current = false;
    }
  };

  // Update the message change effect to reset manual override only for new messages
  useEffect(() => {
    // Only reset manual override if the new message is from user
    // This way, generated text won't reset the override
    const latestMessage = messages[messages.length - 1];
    if (latestMessage && latestMessage.sender === "user") {
      // User sent a new message, reset the override
      manualScrollOverrideRef.current = false;

      // Record the time of auto-scroll to avoid false detection
      const scrollTime = Date.now();
      lastManualScrollTimeRef.current = scrollTime;

      // Force scroll to bottom for user messages
      setTimeout(() => {
        scrollToBottom(true);
      }, 50);
    }
  }, [messages.length]);

  // Helper for formatting time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Check if a specific bot is mentioned in the message
  const checkForBotMention = (message: string) => {
    message = message.toLowerCase();

    // Look for explicit mentions
    const logicMentioned =
      message.includes("logic") || message.includes("logic bot");
    const patternMentioned =
      message.includes("pattern") || message.includes("pattern bot");

    // Return which bot(s) were mentioned, or null if none specifically mentioned
    if (logicMentioned && !patternMentioned) {
      return "logic";
    } else if (patternMentioned && !logicMentioned) {
      return "pattern";
    } else if (logicMentioned && patternMentioned) {
      return "both";
    } else {
      return null; // No specific bot mentioned
    }
  };

  // Update the handleSend function to generate bot answers first
  const handleSend = () => {
    if (
      !finalAnswer.trim() ||
      !scratchboardContent.trim() ||
      typingMessageIds.length > 0
    )
      return;

    // Record user activity
    setLastUserActivityTime(Date.now());

    ensureNoTypingInProgress(() => {
      const userFinalAnswer: Message = {
        id: getUniqueMessageId(),
        sender: "user",
        text: `My final answer is: ${finalAnswer}\n\nMy reasoning:\n${scratchboardContent}`,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userFinalAnswer]);
      setFinalAnswer("");

      // Force scroll to bottom when user submits final answer
      forceScrollToBottomRef.current = true;
      setTimeout(() => scrollToBottom(true), 50);

      // Don't clear scratchboard to allow review
      // Disable further questioning
      setIsQuestioningEnabled(false);
      roundEndedRef.current = true;

      // Generate bot answers first, then official solution
      generateBotFinalAnswers(currentQuestion);
    });
  };

  // Update autoSubmitTimeoutAnswer to also generate bot answers first
  const autoSubmitTimeoutAnswer = () => {
    console.log("Auto-submitting answer due to timeout");

    // Disable further questioning
    setIsQuestioningEnabled(false);
    roundEndedRef.current = true;

    // Only auto-submit if user has written something in the scratchboard
    if (scratchboardContent.trim()) {
      // Use a default final answer text if user hasn't entered one
      const submissionText =
        finalAnswer.trim() || "Time expired - Automatic submission";

      ensureNoTypingInProgress(() => {
        const userFinalAnswer: Message = {
          id: getUniqueMessageId(),
          sender: "user",
          text: `My final answer is: ${submissionText}\n\nMy reasoning:\n${scratchboardContent}`,
          timestamp: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, userFinalAnswer]);
        setFinalAnswer("");

        // Generate bot answers first, then official solution
        generateBotFinalAnswers(currentQuestion);
      });
    } else {
      // If scratchboard is empty, still show bot answers and official solution
      generateBotFinalAnswers(currentQuestion);
    }
  };

  // Update the generateBotFinalAnswers function to use callbacks for sequencing
  const generateBotFinalAnswers = (question: string) => {
    console.log("Generating bot final answers");

    // Generate Logic Bot's answer first
    const logicMessageId = getUniqueMessageId();

    // Add Logic Bot's message with typing indicator
    setMessages((prev) => [
      ...prev,
      {
        id: logicMessageId,
        sender: "ai",
        text: "...",
        agentId: "logic",
        timestamp: new Date().toISOString(),
        onComplete: () => {
          console.log(
            "Logic Bot's answer completed, now showing Pattern Bot's answer"
          );

          // Wait a short time before showing Pattern Bot's answer
          setTimeout(() => {
            // Generate Pattern Bot's answer
            const patternMessageId = getUniqueMessageId();

            // Add Pattern Bot's message with typing indicator
            setMessages((prev) => [
              ...prev,
              {
                id: patternMessageId,
                sender: "ai",
                text: "...",
                agentId: "pattern",
                timestamp: new Date().toISOString(),
                onComplete: () => {
                  console.log(
                    "Pattern Bot's answer completed, now showing official solution"
                  );

                  // Wait a short time before showing the official solution
                  setTimeout(() => {
                    generateOfficialSolution(question);
                  }, 1500);
                },
              },
            ]);

            // Generate Pattern Bot's answer content
            generateSingleBotAnswer(patternMessageId, agents[1], question);
          }, 1500);
        },
      },
    ]);

    // Generate Logic Bot's answer content
    generateSingleBotAnswer(logicMessageId, agents[0], question);
  };

  // New helper function to generate a single bot's answer content
  const generateSingleBotAnswer = async (
    messageId: number,
    agent: any,
    question: string
  ) => {
    try {
      // Generate bot's final answer
      const response = await aiService.generateResponse(
        [
          {
            id: 1,
            sender: "user",
            text: `The problem is: ${question}
                        
As ${agent.name}, provide your own final answer to this problem.
Include your reasoning and solution process.
Keep your answer conversational and natural, as if you're sharing your solution with a peer.
Start with "My answer is..." and then explain how you solved it.`,
          },
        ],
        {
          systemPrompt: agent.systemPrompt,
          model: currentModel,
        }
      );

      // Make sure response starts with "My answer is"
      const formattedResponse = response.startsWith("My answer is")
        ? response
        : `My answer is: ${response}`;

      // Replace typing indicator with actual response
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                text: formattedResponse,
                timestamp: new Date().toISOString(),
              }
            : msg
        )
      );

      // Add to typing state for typewriter effect
      setTypingMessageIds((prev) => [...prev, messageId]);
    } catch (error) {
      console.error(`Error generating ${agent.name}'s final answer:`, error);

      // Provide a fallback message if generation fails
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? {
                ...msg,
                text: `I think I've solved this problem, but I'm having trouble sharing my answer right now.`,
                timestamp: new Date().toISOString(),
              }
            : msg
        )
      );

      // Remove from typing state to prevent hanging
      setTypingMessageIds((prev) => prev.filter((id) => id !== messageId));
      setCompletedMessageIds((prev) => [...prev, messageId]);
    }
  };

  // Modify the generateOfficialSolution function to only show the correct answer
  const generateOfficialSolution = async (question: string) => {
    console.log("Generating official solution");

    // Add system message about the official solution
    const timeoutMessageId = getUniqueMessageId();
    setMessages((prev) => [
      ...prev,
      {
        id: timeoutMessageId,
        sender: "system",
        text: "Here is the official correct answer:",
        timestamp: new Date().toISOString(),
      },
    ]);

    // Add a typing indicator for the solution
    const solutionMessageId = getUniqueMessageId();
    setMessages((prev) => [
      ...prev,
      {
        id: solutionMessageId,
        sender: "system",
        text: "...",
        timestamp: new Date().toISOString(),
      },
    ]);

    // Add to typing state
    setTypingMessageIds((prev) => [...prev, solutionMessageId]);

    try {
      // Generate solution using AI - only request the correct answer
      const solutionPrompt = `You are a math teacher providing only the correct answer to a problem. Be concise and direct.`;

      const response = await aiService.generateResponse(
        [
          {
            id: 1,
            sender: "user",
            text: `Problem: ${question}

Please provide ONLY the correct answer to this problem without any evaluation or feedback.
Keep your response brief, showing just the final answer and any necessary mathematical explanation.
Do not provide any evaluation of student work or suggestions for improvement.`,
          },
        ],
        {
          systemPrompt: solutionPrompt,
          model: currentModel,
        }
      );

      // Replace typing indicator with actual solution
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === solutionMessageId
            ? {
                ...msg,
                text: response,
                timestamp: new Date().toISOString(),
              }
            : msg
        )
      );

      // Add to typing state for animation
      setTypingMessageIds((prev) => [...prev, solutionMessageId]);

      // Set evaluation as complete to enable the "Next Question" button
      setEvaluationComplete(true);
    } catch (error) {
      console.error("Error generating official solution:", error);

      // Provide a fallback message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === solutionMessageId
            ? {
                ...msg,
                text: "Sorry, I couldn't generate the official solution. Please proceed to the next question.",
                timestamp: new Date().toISOString(),
              }
            : msg
        )
      );

      setEvaluationComplete(true);
    }
  };

  // Modify the timer effect to set navigation flag instead of directly navigating
  useEffect(() => {
    if (timeLeft > 0 && !roundEndedRef.current) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            roundEndedRef.current = true;
            // Set navigation flag instead of directly navigating
            setShouldNavigate(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [timeLeft]);

  // Add a new effect to handle navigation
  useEffect(() => {
    if (shouldNavigate) {
      if (currentPromptType === "argumentative") {
        router.push("/break");
      } else {
        startNewRound();
      }
      setShouldNavigate(false);
    }
  }, [shouldNavigate, currentPromptType]);

  // Auto-scroll when messages change
  useEffect(() => {
    // Set a short timeout to ensure the DOM has updated
    setTimeout(scrollToBottom, 50);

    // Reset the userHasScrolled flag when a new message is added
    setUserHasScrolled(false);
  }, [messages.length]);

  // Handler for user question
  const handleUserQuestion = () => {
    if (!input.trim() || typingMessageIds.length > 0) return;

    // Record user activity
    setLastUserActivityTime(Date.now());

    const userMessage: Message = {
      id: getUniqueMessageId(),
      sender: "user",
      text: input,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    // Force scroll to bottom when user sends a message
    forceScrollToBottomRef.current = true;
    setTimeout(() => scrollToBottom(true), 50);

    // Check if a specific bot was mentioned
    const mentionedBot = checkForBotMention(userMessage.text || "");

    // Generate AI responses based on which bot was mentioned
    generateAIResponse(userMessage.text || "", mentionedBot);
  };

  // AI response generation
  const generateAIResponse = async (
    userMessage: string,
    mentionedBot: string | null
  ) => {
    // Don't generate responses if time's up
    if (roundEndedRef.current) return;

    // Determine which bot(s) should respond
    let selectedAgentIndex: number;

    if (mentionedBot === "logic") {
      // Only Logic Bot should respond
      selectedAgentIndex = 0;
    } else if (mentionedBot === "pattern") {
      // Only Pattern Bot should respond
      selectedAgentIndex = 1;
    } else {
      // Either no specific bot was mentioned, or both were mentioned
      // For 'both', we'll start with a random one, then the other will respond as follow-up
      selectedAgentIndex = Math.random() < 0.5 ? 0 : 1;
    }

    const selectedAgent = agents[selectedAgentIndex];

    console.log(`Generating response from ${selectedAgent.name}`);
    setBotThinking(true);

    try {
      // Show typing indicator temporarily
      const tempMessageId = getUniqueMessageId();
      setMessages((prev) => [
        ...prev,
        {
          id: tempMessageId,
          sender: "ai",
          text: "...",
          agentId: selectedAgent.id,
          timestamp: new Date().toISOString(),
        },
      ]);

      // Generate AI response using the correct API call
      const response = await aiService.generateResponse(
        [
          {
            id: 1,
            sender: "user",
            text: `The current problem is: ${currentQuestion}`,
          },
          {
            id: 2,
            sender: "user",
            text: `The student asked: ${userMessage}`,
          },
        ],
        {
          systemPrompt: selectedAgent.systemPrompt,
          model: currentModel,
        }
      );

      // Replace typing indicator with actual message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempMessageId
            ? {
                ...msg,
                text: response,
                timestamp: new Date().toISOString(),
              }
            : msg
        )
      );

      // Add to typing state
      setTypingMessageIds((prev) => [...prev, tempMessageId]);

      // Check if the other agent should also respond
      // Only if both bots were mentioned or no specific bot was mentioned
      if (
        (mentionedBot === "both" || mentionedBot === null) &&
        Math.random() < 0.3
      ) {
        const otherAgentIndex = 1 - selectedAgentIndex;
        const otherAgent = agents[otherAgentIndex];

        // Wait a bit before second agent responds
        setTimeout(() => {
          generateFollowUpResponse(otherAgent, userMessage, response);
        }, 1000);
      }
    } catch (error) {
      console.error("Error generating AI response:", error);
      setMessages((prev) => prev.filter((msg) => msg.text !== "..."));
    } finally {
      setBotThinking(false);
    }
  };

  // Follow-up response generation
  const generateFollowUpResponse = async (
    agent: any,
    userMessage: string,
    firstAgentResponse: string
  ) => {
    // Don't generate responses if time's up
    if (roundEndedRef.current) return;

    console.log(`Generating follow-up from ${agent.name}`);
    setBotThinking(true);

    try {
      // Show typing indicator temporarily
      const tempMessageId = getUniqueMessageId();
      setMessages((prev) => [
        ...prev,
        {
          id: tempMessageId,
          sender: "ai",
          text: "...",
          agentId: agent.id,
          timestamp: new Date().toISOString(),
        },
      ]);

      // Generate AI response using the correct API call
      const response = await aiService.generateResponse(
        [
          {
            id: 1,
            sender: "user",
            text: `The current problem is: ${currentQuestion}`,
          },
          {
            id: 2,
            sender: "user",
            text: `The student asked: ${userMessage}`,
          },
          {
            id: 3,
            sender: "user",
            text: `The other AI student responded: ${firstAgentResponse}`,
          },
          {
            id: 4,
            sender: "user",
            text: "Provide your perspective on this problem, possibly building on what the other student said or offering an alternative approach. Keep it conversational and helpful.",
          },
        ],
        {
          systemPrompt: agent.systemPrompt,
          model: currentModel,
        }
      );

      // Replace typing indicator with actual message
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempMessageId
            ? {
                ...msg,
                text: response,
                timestamp: new Date().toISOString(),
              }
            : msg
        )
      );

      // Add to typing state
      setTypingMessageIds((prev) => [...prev, tempMessageId]);
    } catch (error) {
      console.error("Error generating follow-up response:", error);
      setMessages((prev) => prev.filter((msg) => msg.text !== "..."));
    } finally {
      setBotThinking(false);
    }
  };

  // Update the startNewRound function
  const startNewRound = async () => {
    // Wait for questions to load if they haven't yet
    if (!loadedQuestions) {
      console.log("Waiting for questions to load...");
      setTimeout(startNewRound, 500);
      return;
    }

    // Reset state for new round
    console.log("Starting new round");
    setMessages([]);
    setCompletedMessageIds([]);
    setTypingMessageIds([]);
    setEvaluationComplete(false);
    setScratchboardContent("");
    setInput("");
    setFinalAnswer("");
    setUserHasScrolled(false);

    try {
      // Get a random question from the loaded questions
      let newIndex = currentQuestionIndex;
      while (
        usedQuestionIndices.includes(newIndex) &&
        usedQuestionIndices.length < allQuestions.length
      ) {
        newIndex = Math.floor(Math.random() * allQuestions.length);
      }

      setCurrentQuestionIndex(newIndex);
      setUsedQuestionIndices((prev) => [...prev, newIndex]);

      const selectedQuestion = allQuestions[newIndex];
      setCurrentQuestion(selectedQuestion);

      // Reset timer and enable questioning
      setTimeLeft(timerDuration);
      setIsQuestioningEnabled(true);
      roundEndedRef.current = false;
    } catch (error) {
      console.error("Error starting new round:", error);
      // Use fallback question
      setCurrentQuestion(
        "What are the most important things students should learn in school?"
      );
      setTimeLeft(timerDuration);
      setIsQuestioningEnabled(true);
      roundEndedRef.current = false;
    }
  };

  // Update the useEffect for loading questions
  useEffect(() => {
    if (loadedQuestions) {
      // Get a random creative prompt for the first round
      const creativePrompts = Object.keys(creativeTopics);
      const randomCreativePrompt =
        creativePrompts[Math.floor(Math.random() * creativePrompts.length)];

      // Set the prompt and corresponding agents
      setCurrentPrompt(randomCreativePrompt);
      setCurrentPromptType("creative");
      const initialAgents = getAgentsForPrompt(
        randomCreativePrompt,
        "creative"
      );
      setAgents(initialAgents);

      // Start the first round with the selected prompt
      startNewRound();
    }
  }, [loadedQuestions]);

  // Modify the handleNextQuestion function
  const handleNextQuestion = () => {
    if (currentRound === 0) {
      // Move to second round with argumentative prompt
      const argumentativePrompts = Object.keys(argumentativeTopics);
      const randomArgumentativePrompt =
        argumentativePrompts[
          Math.floor(Math.random() * argumentativePrompts.length)
        ];

      setCurrentPrompt(randomArgumentativePrompt);
      setCurrentPromptType("argumentative");
      setAgents(getAgentsForPrompt(randomArgumentativePrompt, "argumentative"));
      setCurrentRound(1);
      setTimeLeft(timerDuration);
      setFinalAnswer("");
      setScratchboardContent("");
      setMessages([]);
      setCompletedMessageIds([]);
      setTypingMessageIds([]);
      setIsQuestioningEnabled(true);
      setEvaluationComplete(false);
    } else if (currentRound === 1) {
      // Move to break screen
      setCurrentRound(2);
      router.push("/break");
    }
  };

  // Add this helper function to count words
  const countWords = (text: string): number => {
    return text.trim().split(/\s+/).length;
  };

  // Add this function to generate feedback for new content
  const generateProgressFeedback = async (newContent: string) => {
    if (isFeedbackInProgress) return;
    setIsFeedbackInProgress(true);

    // Randomize agent order
    const shuffledAgents = [...agents].sort(() => Math.random() - 0.5);

    // Helper function to generate response for a single agent
    const generateAgentResponse = async (agentIndex: number) => {
      const agent = shuffledAgents[agentIndex];
      const messageId = getUniqueMessageId();

      // Add typing indicator
      setMessages((prev) => [
        ...prev,
        {
          id: messageId,
          sender: "ai",
          text: "...",
          agentId: agent.id,
          timestamp: new Date().toISOString(),
          onComplete: () => {
            // When this message completes, trigger the next agent's response
            if (agentIndex < shuffledAgents.length - 1) {
              setTimeout(() => {
                generateAgentResponse(agentIndex + 1);
              }, 1500);
            } else {
              // All agents have responded
              setIsFeedbackInProgress(false);
            }
          },
        },
      ]);

      try {
        const response = await aiService.generateResponse(
          [
            {
              id: 1,
              sender: "user",
              text: `The current problem is: ${currentQuestion}\n\nThe student has written this new content in their essay:\n${newContent}\n\nAs ${agent.name}, provide brief, encouraging feedback on their progress. Focus on one specific aspect of their writing. Keep it concise and constructive.`,
            },
          ],
          {
            systemPrompt: agent.systemPrompt,
            model: currentModel,
          }
        );

        // Update message with actual response
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  text: response,
                  timestamp: new Date().toISOString(),
                  onComplete: msg.onComplete, // Preserve the onComplete callback
                }
              : msg
          )
        );

        setTypingMessageIds((prev) => [...prev, messageId]);
      } catch (error) {
        console.error(`Error generating feedback from ${agent.name}:`, error);
        // In case of error, still trigger the next agent
        if (agentIndex < shuffledAgents.length - 1) {
          setTimeout(() => {
            generateAgentResponse(agentIndex + 1);
          }, 1500);
        } else {
          setIsFeedbackInProgress(false);
        }
      }
    };

    // Start with the first agent
    await generateAgentResponse(0);
  };

  return (
    <div className="h-screen bg-gradient-to-b from-[#2D0278] to-[#0A001D] p-4 flex flex-row overflow-hidden">
      {/* LEFT PANEL - Problem, Submission, Scratchboard */}
      <div className="w-1/2 pr-2 flex flex-col h-full overflow-hidden">
        {/* Problem Display with Timer inside */}
        {currentQuestion && (
          <div className="bg-white bg-opacity-20 p-4 rounded-md mb-4 border-2 border-purple-400">
            <div className="flex justify-between items-start mb-2">
              <h2 className="text-xl text-white font-semibold">
                Writing Prompt:
              </h2>
              {/* Timer integrated in problem statement */}
              <div
                className={`p-2 rounded-lg ${
                  timeLeft > 20
                    ? "bg-green-700"
                    : timeLeft > 10
                    ? "bg-yellow-600 animate-pulse"
                    : "bg-red-700 animate-pulse"
                } ml-4`}
              >
                <div className="text-xl font-mono text-white">
                  {formatTime(timeLeft)}
                </div>
                {timeLeft <= 20 && (
                  <div className="text-xs text-white text-center">
                    {timeLeft <= 10 ? "Time almost up!" : "Finish soon!"}
                  </div>
                )}
              </div>
            </div>
            <p className="text-white text-lg">{currentQuestion}</p>
          </div>
        )}

        {/* Final Answer */}
        <div className="flex flex-col bg-white bg-opacity-15 rounded-md p-4 mb-4 h-full border-2 border-blue-400 shadow-lg">
          <h3 className="text-xl text-white font-semibold mb-2">Your Essay</h3>
          <div className="flex grow flex-col space-y-3">
            <textarea
              value={finalAnswer}
              onChange={(e) => {
                setFinalAnswer(e.target.value);

                // Check word count and generate feedback if needed
                const currentWordCount = countWords(e.target.value);
                if (
                  currentWordCount >=
                  lastProcessedWordCount + WORDS_THRESHOLD
                ) {
                  const newWords = e.target.value
                    .split(/\s+/)
                    .slice(lastProcessedWordCount)
                    .join(" ");
                  generateProgressFeedback(newWords);
                  setLastProcessedWordCount(currentWordCount);
                }
              }}
              placeholder="Enter your final answer here..."
              className="w-full grow bg-white bg-opacity-10 text-white border border-gray-600 rounded-md px-3 py-3 text-lg"
            />
            <button
              onClick={() => handleSend()}
              disabled={
                !finalAnswer.trim() ||
                !scratchboardContent.trim() ||
                typingMessageIds.length > 0
              }
              className={`px-4 py-3 rounded-md text-lg font-medium ${
                finalAnswer.trim() &&
                scratchboardContent.trim() &&
                typingMessageIds.length === 0
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "bg-gray-700 text-gray-400 cursor-not-allowed"
              }`}
            >
              Submit Essay
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - Chat */}
      <div className="w-1/2 pl-2 flex flex-col h-full">
        <div className="flex-1 bg-white bg-opacity-10 rounded-md flex flex-col overflow-hidden">
          {/* Agent info for group/multi modes */}
          <div className="bg-black bg-opacity-30 p-2">
            <div className="flex space-x-3">
              {agents.map((agent) => (
                <div key={agent.id} className="flex items-center">
                  <Image
                    src={agent.avatar}
                    alt={agent.name}
                    width={40}
                    height={40}
                    className="rounded-full border-2 border-white"
                  />
                  <span className="text-xs text-white ml-2">{agent.name}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chat messages - Scrollable */}
          <div
            className="flex-1 p-4 overflow-y-auto"
            ref={chatContainerRef}
            onScroll={handleScroll}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`mb-4 flex ${
                  msg.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.sender === "ai" && (
                  <div className="mr-2 flex-shrink-0">
                    <Image
                      src={
                        agents.find((a) => a.id === msg.agentId)?.avatar ||
                        "/logic_avatar.png"
                      }
                      alt={
                        agents.find((a) => a.id === msg.agentId)?.name || "AI"
                      }
                      width={40}
                      height={40}
                      className="rounded-full border-2 border-white"
                    />
                  </div>
                )}

                <div
                  className={`max-w-[75%] rounded-lg p-3 ${
                    msg.sender === "user"
                      ? "bg-blue-600 text-white"
                      : msg.sender === "system"
                      ? "bg-purple-700 text-white"
                      : "bg-white bg-opacity-10 text-white"
                  }`}
                >
                  {msg.sender === "ai" && (
                    <div className="text-sm text-gray-300 mb-1 font-bold">
                      {agents.find((a) => a.id === msg.agentId)?.name || "AI"}
                    </div>
                  )}

                  {msg.sender === "system" && (
                    <div className="text-sm text-gray-300 mb-1 font-bold">
                      Official Solution
                    </div>
                  )}

                  {typingMessageIds.includes(msg.id) ? (
                    <TypewriterTextWrapper
                      key={`typewriter-${msg.id}`}
                      text={msg.text}
                      speed={20}
                      messageId={msg.id}
                      onTypingProgress={(progress) => {
                        if (!userHasScrolled) {
                          scrollToBottom();
                        }
                      }}
                      onTypingComplete={() => {
                        console.log(`Message ${msg.id} completed typing`);

                        setTimeout(() => {
                          if (typingMessageIds.includes(msg.id)) {
                            setTypingMessageIds((prev) =>
                              prev.filter((id) => id !== msg.id)
                            );
                            setCompletedMessageIds((prev) => [...prev, msg.id]);

                            if (msg.onComplete) {
                              msg.onComplete();
                            }

                            if (!userHasScrolled) {
                              scrollToBottom();
                            }
                          }
                        }, 100);
                      }}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap">{msg.text}</div>
                  )}
                </div>
              </div>
            ))}
            <div key="messages-end" />
          </div>

          {/* Chat input (for questions only, separate from final answer) */}
          {isQuestioningEnabled && (
            <div className="p-3 bg-black bg-opacity-30">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Converse with your peers..."
                  className="flex-1 bg-white bg-opacity-10 text-white border border-gray-700 rounded-md px-3 py-2"
                  disabled={isFeedbackInProgress}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleUserQuestion();
                    }
                  }}
                />
                <button
                  onClick={handleUserQuestion}
                  disabled={
                    !input.trim() ||
                    typingMessageIds.length > 0 ||
                    isFeedbackInProgress
                  }
                  className={`px-4 py-2 rounded-md ${
                    input.trim() &&
                    typingMessageIds.length === 0 &&
                    !isFeedbackInProgress
                      ? "bg-blue-600 hover:bg-blue-700 text-white"
                      : "bg-gray-700 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  Ask
                </button>
              </div>
            </div>
          )}

          {/* Next question button (when time's up) */}
          {!isQuestioningEnabled && evaluationComplete && (
            <div className="p-3 bg-black bg-opacity-30 flex justify-center">
              <button
                onClick={handleNextQuestion}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md"
              >
                Next Question
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
