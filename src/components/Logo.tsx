
'use client';
import {useTranslation} from '@/context/LocaleContext';
export default function Logo() {
 const {t:tr}=useTranslation();

    return (
        <div className="w-40 h-15 bg-linear-to-tl from-blue-400 to-green-400 rounded-4xl relative text-2xl text-white font-bold">
            <span className="absolute left-5 top-2.5">{tr("Logo yo'q")}</span>
        </div>
    )
}