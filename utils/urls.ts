export class UrlUtils {
    public static buildSiteUrl(siteUrl: string, url: string): string {
        let surl = siteUrl;
        if (!surl.endsWith('/')) {
            surl = surl + '/';
        }

        if (!surl.startsWith('https://') && !surl.startsWith('http://')) {
            surl = 'https://' + surl;
        }

        return surl + url;
    }
}
