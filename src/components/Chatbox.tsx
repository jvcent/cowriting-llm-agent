// components/ChatBox.tsx
'use client'

import { Button } from "./ui/button";
import SendIcon from '@mui/icons-material/Send';

export const ChatBox = () => {
    return (
        <div className="w-full max-w-screen-xl mx-auto px-4"> {/* Matches blackboard width */}
            <div className="bg-white bg-opacity-10 backdrop-blur-lg rounded-lg shadow-xl focus:ring-white focus:ring-opacity-30">
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Type your message..."
                        className="w-full pr-20 px-4 py-3 bg-transparent text-foreground rounded-lg"
                    />
                    <Button className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-transparent hover:bg-transparent hover:text-white/70 text-white/30 rounded-md transition-all">
                        <SendIcon />
                    </Button>
                </div>
            </div>
        </div>
    );
};