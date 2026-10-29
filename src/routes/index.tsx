import {createFileRoute} from '@tanstack/react-router';
import {Desktop} from '@/components/desktop/Desktop';
import {NotePreview} from '@/components/NotePreview';
export const Route=createFileRoute('/')({component:import.meta.env.MODE==='paper-study'?NotePreview:Desktop});
