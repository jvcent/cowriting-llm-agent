"use client"

/* Components */
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import MenuIcon from "@mui/icons-material/Menu";
import { Separator } from "./ui/separator";
import { Checkbox } from "./ui/checkbox";
import { ScrollArea } from "./ui/scroll-area";

const lessons = [
    {
        name: "1.1 Lesson Name",
        completed: true,
    },
    {
        name: "1.2 Lesson Name",
        completed: false,
    },
    {
        name: "1.3 Lesson Name",
        completed: false,
    },
    {
        name: "1.4",
        completed: false,
    },
    {
        name: "1.5",
        completed: false,
    },
    {
        name: "1.6",
        completed: false,
    },
    {
        name: "1.7",
        completed: false,
    },
    {
        name: "1.8",
        completed: false,
    },
    {
        name: "1.9",
        completed: false,
    },
    {
        name: "1.10",
        completed: false,
    },
    {
        name: "2.1 Lesson Name",
        completed: false,
    },
    {
        name: "2.2 Lesson Name",
        completed: false,
    },
    {
        name: "2.3 Lesson Name",
        completed: false,
    },
    {
        name: "2.4 Lesson Name",
        completed: false,
    },
    {
        name: "2.5 Lesson Name",
        completed: false,
    },
    {
        name: "2.6 Lesson Name",
        completed: false,
    },
    {
        name: "2.7 Lesson Name",
        completed: false,
    },
    {
        name: "2.8 Lesson Name",
        completed: false,
    },
    {
        name: "2.9 Lesson Name",
        completed: false,
    },
    {
        name: "2.10 Lesson Name",
        completed: false,
    }
];

const Sidebar = () => {
    return (
        <div className="bg-transparent flex flex-col h-full">
            <Sheet>
                <SheetTitle>
                    <SheetTrigger className="flex justify-center items-center z-0">
                        <MenuIcon sx={{ fontSize: 45 }} color="primary" />
                    </SheetTrigger>
                </SheetTitle>

                <SheetContent
                    side="left"
                    className="bg-gradient-to-b from-[#2D0278] to-[#0A001D] text-foreground border-none flex flex-col h-full"
                >
                    <div className="my-8 mx-4 flex flex-col h-full">
                        <p className="font-secondary text-4xl text-foreground mb-4">
                            Topic
                        </p>

                        {/* Adjusted ScrollArea to flex-1 and added scrollbar class */}
                        <ScrollArea className="flex-1 scrollbar" type="scroll">
                            <div className="p-4">
                                {lessons.map((lesson, idx) => (
                                    <div key={idx}>
                                        <div className="flex gap-4 items-center">
                                            <Checkbox className="w-8 h-8" defaultChecked={lesson.completed} />
                                            <div className="text-lg my-4">{lesson.name}</div>
                                        </div>
                                        <Separator className="my-2 bg-primary" />
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}

export default Sidebar;