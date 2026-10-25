import { useEffect, useState } from 'react';
import { useApp } from '../state/app';
import { verifiedPhoto } from '../lib/photo-verification';

export function VerifiedPhoto({hash,alt,className='',eager=false}:{hash:string;alt:string;className?:string;eager?:boolean}) {
  const {backend}=useApp(); const source=backend?.docUrl(hash) ?? '';
  const [state,setState]=useState<{source:string;url?:string;error?:string;small?:{width:number;height:number}}>({source:''});
  useEffect(()=>{
    let dead=false,url:string|undefined; const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),10000);
    (async()=>{
      try {
        if(!source) throw new Error('Photo service unavailable.');
        const response=await fetch(source,{signal:controller.signal}); if(!response.ok) throw new Error('Photo could not be retrieved.');
        const bytes=new Uint8Array(await response.arrayBuffer()); const mime=await verifiedPhoto(bytes,hash);
        if(dead) return;
        url=URL.createObjectURL(new Blob([bytes as BlobPart],{type:mime}));setState({source,url});
      } catch(error) {if(!dead) setState({source,error:error instanceof Error && error.name!=='AbortError'?error.message:'Photo verification timed out.'});}
      finally {clearTimeout(timeout);}
    })();
    return ()=>{dead=true;clearTimeout(timeout);controller.abort();if(url) URL.revokeObjectURL(url);};
  },[source,hash]);
  const current=state.source===source?state:undefined;
  if(current?.url) {
    const description=`${alt} · content hash verified; physical ownership is not independently verified`;
    const failed=()=>setState({source,error:'The verified file could not be decoded as an image.'});
    if(current.small) return <figure className={`${className} verified-photo-original`}><img src={current.url} alt={description} style={{width:current.small.width,height:current.small.height,objectFit:'contain'}} onError={failed}/><figcaption>Original recorded image · {current.small.width} × {current.small.height} pixels<br/>Shown without enlarging or replacing its bytes.</figcaption></figure>;
    return <img className={className} src={current.url} alt={description} loading={eager?'eager':'lazy'} onLoad={event=>{const image=event.currentTarget;if(image.naturalWidth<160 && image.naturalHeight<160) setState({...current,small:{width:image.naturalWidth,height:image.naturalHeight}});}} onError={failed}/>;
  }
  return <div className={`${className} verified-photo-fallback`} role="img" aria-label={`${alt}: ${current?.error ?? 'checking photo'}`}><span>{current?.error ? 'Verified photo unavailable' : 'Checking photo…'}</span>{current?.error && <small>{current.error}</small>}</div>;
}
