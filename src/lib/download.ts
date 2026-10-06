export function downloadHtml(file:{filename:string;content:string}){downloadFile(file,'text/html;charset=utf-8')}
export function downloadCsv(file:{filename:string;content:string}){downloadFile(file,'text/csv;charset=utf-8')}
function downloadFile(file:{filename:string;content:string},type:string){
 const url=URL.createObjectURL(new Blob([file.content],{type}))
 const link=document.createElement('a');link.href=url;link.download=file.filename;document.body.append(link);link.click();link.remove()
 setTimeout(()=>URL.revokeObjectURL(url),1000)
}
