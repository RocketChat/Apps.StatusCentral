import { IServiceModel } from '../models/service';
import { RcStatusApp } from '../RcStatusApp';
import { IContainer } from './../models/container';

import { HttpStatusCode, IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApiRequest, IApiResponse } from '@rocket.chat/apps-engine/definition/api';
import { ApiEndpoint } from '@rocket.chat/apps-engine/definition/api/ApiEndpoint';
import { IApiEndpointInfo } from '@rocket.chat/apps-engine/definition/api/IApiEndpointInfo';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';

export class ServiceSelectionApi extends ApiEndpoint {
    constructor(app: RcStatusApp) {
        super(app);
        this.path = 'service';
    }

    public async get(request: IApiRequest, endpoint: IApiEndpointInfo, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<IApiResponse> {
        this.app.getLogger().log(request);

        const userAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, request.query.userId);
        const roomAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, request.query.roomId);
        const existing = await read.getPersistenceReader().readByAssociations([userAssoc, roomAssoc]);

        if (existing.length === 1 && request.query.service) {
            const record = existing[0] as IContainer;

            if (!record.data.services) {
                record.data.services = [];
            }

            const service: Partial<IServiceModel> = { name: request.query.service };
            const found = record.data.services.find((s) => s.name === service.name);

            if (!found) {
                record.data.services.push(service);
            }

            await persis.removeByAssociations([userAssoc, roomAssoc]);
            await persis.createWithAssociations(record, [userAssoc, roomAssoc]);

            this.app.getLogger().log(record);
        }

        return {
            status: HttpStatusCode.OK,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
            },
            content: '<html><body> <script type="text/javascript">window.close();</script> </body></html>',
        };
    }
}
