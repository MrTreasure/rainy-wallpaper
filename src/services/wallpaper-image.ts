import type {Wallpaper} from './desktop-types';
/** Keep Unsplash's source/tracking parameters while requesting a 4K display image. */
export function highResolutionWallpaper(photo:Wallpaper):Wallpaper{
 let source:URL;try{source=new URL(photo.originalUrl??photo.url)}catch{return photo}
 if(source.protocol!=='https:'||source.hostname!=='images.unsplash.com')return photo;
 for(const key of ['w','h','dpr','q','fit','auto','fm','dl'])source.searchParams.delete(key);
 source.searchParams.set('w','3840');source.searchParams.set('q','90');source.searchParams.set('fit','max');source.searchParams.set('auto','format');
 return {...photo,url:source.href};
}
/** Match decoded pixels to the actual screen; originals remain downloadable. */
export function displayWallpaperUrl(photo:Wallpaper,width=innerWidth,height=innerHeight,dpr=devicePixelRatio||1){
 const source=new URL(highResolutionWallpaper(photo).url);
 const aspect=(photo.width??3840)/(photo.height??2160);
 const needed=Math.max(width+48,(height+48)*aspect)*Math.min(2,dpr);
 source.searchParams.set('w',String(Math.min(3840,Math.max(1280,Math.ceil(needed/256)*256))));return source.href;
}
