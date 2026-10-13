import type {ComponentProps} from 'react';
// Retain native table semantics and caller-defined financial column layouts.
export default function DataTable({className='',...props}:ComponentProps<'table'>){
  return <table {...props} className={'w-full text-left text-xs '+className}/>;
}
