import { useState } from 'react';

interface ScratchboardProps {
    isOpen: boolean;
    onClose: () => void;
    onContentChange: (content: string) => void;
}

export default function Scratchboard({ isOpen, onClose, onContentChange }: ScratchboardProps) {
    const [notes, setNotes] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setNotes(e.target.value);
        onContentChange(e.target.value);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">Scratchboard</h2>
                    <button
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        ✕
                    </button>
                </div>
                <textarea
                    value={notes}
                    onChange={handleChange}
                    className="w-full h-96 p-4 border rounded-lg resize-none"
                    placeholder="Write your reasoning process here..."
                />
            </div>
        </div>
    );
}