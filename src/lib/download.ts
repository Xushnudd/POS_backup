export function downloadCsv(file:{filename:string;content:string}){
 const url=URL.createObjectURL(new Blob([file.content],{type:'text/csv;charset=utf-8'}))
 const link=document.createElement('a');link.href=url;link.download=file.filename;document.body.append(link);link.click();link.remove()
 setTimeout(()=>URL.revokeObjectURL(url),1000)
}
