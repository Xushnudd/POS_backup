import {ApiError} from '@/lib/api';
import {ownedErrorMessage} from './messages';
import {errorGuidance} from '@/lib/error-guidance';
/** UI boundary only. Keep original machine error/code/details intact for
 * recovery, while displaying reviewed guidance that has both translations. */
export function errorMessage(error:unknown,fallback='Amalni bajarib bo‘lmadi.'):string{
 if(error instanceof ApiError){
  const guide=errorGuidance(error.code??'INTERNAL_ERROR');
  return guide.message+' '+guide.nextAction+(error.requestId?' So‘rov: '+error.requestId:'');
 }
 return ownedErrorMessage(error,fallback);
}
