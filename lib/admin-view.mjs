import {validCoordinates} from './health-model.mjs';
export const groupIsVisible=(selection,group)=>selection===null||selection.has(group);
export function toggleGroup(selection,group,allGroups){const next=new Set(selection===null?allGroups:selection);if(next.has(group))next.delete(group);else next.add(group);return next;}
export function patientMapLinks(patient){
 if(!validCoordinates({latitude:patient.lat,longitude:patient.lng}))return null;
 const point=`${patient.lat},${patient.lng}`;
 return {coordinates:point,map:'https://www.google.com/maps/search/?'+new URLSearchParams({api:'1',query:point}),directions:'https://www.google.com/maps/dir/?'+new URLSearchParams({api:'1',destination:point,travelmode:'driving'}),streetView:'https://www.google.com/maps/@?'+new URLSearchParams({api:'1',map_action:'pano',viewpoint:point})};
}
export function photoDisplayUrl(value){try{const u=new URL(value);if(u.protocol!=='https:')return '';if(u.hostname==='lh3.googleusercontent.com')return u.href;if(u.hostname!=='drive.google.com')return '';const id=u.pathname.match(/^\/file\/d\/([\w-]+)/)?.[1]||u.searchParams.get('id');if(id&&/^[\w-]+$/.test(id))return 'https://drive.google.com/thumbnail?'+new URLSearchParams({id,sz:'w800'});return u.href;}catch{return '';}}
