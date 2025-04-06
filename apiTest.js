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

const writingTopic = `What Are the Most Important Things Students Should Learn in School? `

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
                messages: [
                    {
                        role: 'user',
                        content: `The user is writing creative essay on ${writingTopic}.  

                        Give 3 personas AND system prompts for LLM peers who could help the advice and provide feedback for the user to write an essay which: 
                        (i) Contains meaningful essay content
                        (i) Produce meaningful essay content 
                        (ii) maximize essay level diversity – be as different as possible from all the other users who may
                             be writing an essay on this essay 
                        (iii) maximize key point level diversity – assuming each essay is reduced to a set of key points of central arguments. 
                             This type of diversity measures conceptual alignment rather than just textual similarity, revealing whether essays 
                             express similar ideas, not just similar words. 
                             
                        Ensure the system prompts are detailed and distinct, each with its own unique and varying opinions, backgrounds, and stances on this topic. 

                        The peers should be able to have a good constructive conversation with each other in the chat such that the user on reading 
                        these chats could come up with an essay that is concise, diverse, and effective. 
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