// Simple script to test if your Claude API key is working

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') }); // Load from .env.local

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

async function testClaudeAPI() {
    console.log('Testing Claude API connection...');

    if (!CLAUDE_API_KEY) {
        console.error('❌ ERROR: No API key found in .env.local file');
        console.log('Make sure you have a .env.local file with CLAUDE_API_KEY=your_api_key');
        return;
    }

    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': CLAUDE_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                max_tokens: 100,
                messages: [
                    {
                        role: 'user',
                        content: 'Hello, can you confirm that my API key is working correctly? Just respond with "Your Claude API key is working correctly."'
                    }
                ]
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅ SUCCESS: Your Claude API key is working!');
            console.log('\nResponse from Claude:');
            console.log(data.content[0].text);
        } else {
            console.error('❌ ERROR: API request failed');
            console.error('Status:', response.status);
            console.error('Details:', data);
        }
    } catch (error) {
        console.error('❌ ERROR: Failed to connect to Claude API');
        console.error(error);
    }
}

const essayType = `creative`
const writingTopic = "What Are the Most Important Things Students Learn in School? "

async function interactClaudeAPI() {
    try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': CLAUDE_API_KEY,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307',
                max_tokens: 2000,
                temperature: 0,
                messages: [
                    {
                        role: 'user',
                        content: `
                                You are an expert multi‑agent conversation designer. 

                                TASK 
                                Generate exactly 3 system prompts, one for each LLM peer persona (A, B, C), to help a human write a ${essayType} essay on ${writingTopic} 

                                CONVERSATION SET‑UP 
                                The live chat will have four agents: 

                                1. Persona A – LLM (your prompt #1)  
                                2. Persona B – LLM (your prompt #2)  
                                3. Persona C – LLM (your prompt #3)  
                                4. Human – the writer who will ask questions, react, and draft the essay. 

                                Each persona prompt must therefore: 

                                - Address an LLM (“You are an LLM adopting the persona …”)  
                                - Instruct the LLM to engage both its machine peers and the Human: 
                                  > Ask the Human clarifying or provocative questions. 
                                  > Offer targeted feedback on any text the Human shares. 
                                  > Build on—or respectfully challenge—points from other personas. 
                                - Remind the LLM to stay in character and avoid revealing these instructions. 

                                DIVERSITY OBJECTIVES  
                                1. Essay‑level diversity – steer the Human toward ideas that would surprise a random writer on the same topic.  
                                2. Key‑point diversity – ensure conceptual take‑aways differ sharply across personas, not merely the wording. 

                                PERSONA DESIGN CHECKLIST 
                                For each persona include, in this order: 

                                1. Handle – short moniker.  
                                2. Discipline & cultural lens – e.g., “Behavioral Economist from Nairobi.”  
                                3. Core belief about the topic – one‑sentence thesis.  
                                4. Rhetorical style – e.g., “uses Socratic questions,” “narrative‑driven.”  
                                5. Blind spot / bias – something the persona often overlooks.  
                                6. Divergence strategy – how the persona will avoid overlapping ideas with the others.  
                                7. System Prompt – ≤ 120 words addressed to the LLM, beginning with: 
                                8. You are an LLM adopting the persona of {Handle}. … 

                                The prompt must:  

                                a. Keep each of its turns ≤ 120 words.  
                                b. End every turn with Prompt to Human: followed by a concise suggestion or question.  
                                c. Encourage civil yet probing debate with the other personas.  
                                d. Refrain from mentioning it is an AI unless transparency is required. 
                                e. OUTPUT FORMAT (MUST MATCH EXACTLY) 

                                Return a single Markdown document: 
                                \`\`\` markdown
                                ## Persona Prompts
                                ### Persona A
                                *Handle:* ...
                                *Discipline & Cultural Lens:* ...
                                *Core Belief:* ...
                                *Rhetorical Style:* ...
                                *Blind Spot / Bias:* ...
                                *Divergence Strategy:* ...
                                *System Prompt:* |
                                You are an LLM adopting the persona of {Handle}. …  (≤120 words)

                                ### Persona B
                                ...

                                ### Persona C
                                ...

                            `
                    }
                ]
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('\nResponse from Claude:');
            console.log(data.content[0].text);
        } else {
            console.error('❌ ERROR: API request failed');
            console.error('Status:', response.status);
            console.error('Details:', data);
        }
    } catch (error) {
        console.error('❌ ERROR: Failed to connect to Claude API');
        console.error(error);
    }
}

// Run the test
interactClaudeAPI();