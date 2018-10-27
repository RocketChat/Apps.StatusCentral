import { HttpStatusCode } from '@rocket.chat/apps-engine/definition/accessors';
import { IApiResponse } from '@rocket.chat/apps-engine/definition/api';

export class ApiResponseUtilities {
    public static getAutoClosingHtml(): IApiResponse {
        return {
            status: HttpStatusCode.OK,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
            },
            content: '<html><body> <script type="text/javascript">window.close();</script> </body></html>',
        };
    }
}
