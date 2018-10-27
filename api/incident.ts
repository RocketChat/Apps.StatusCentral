import { IContainer } from '../models/container';
import { RcStatusApp } from '../RcStatusApp';
import { ApiResponseUtilities } from '../utils/apiResponses';

import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { ApiEndpoint, IApiEndpointInfo, IApiRequest, IApiResponse } from '@rocket.chat/apps-engine/definition/api';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { IncidenStatusEnum } from '../enums/incidentStatus';

export class IncidentStatusApi extends ApiEndpoint {
    constructor(app: RcStatusApp) {
        super(app);

        this.path = 'incident';
    }

    public async get(request: IApiRequest, endpoint: IApiEndpointInfo, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<IApiResponse> {
        const userAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, request.query.userId);
        const roomAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, request.query.roomId);
        const existing = await read.getPersistenceReader().readByAssociations([userAssoc, roomAssoc]);

        if (existing.length < 1 && !request.query.status) {
            return ApiResponseUtilities.getAutoClosingHtml();
        }

        const record = existing[0] as IContainer;
        const { status } = request.query;

        this.app.getLogger().log(`Setting the status of the incident to ${ IncidenStatusEnum[status] }`);

        record.data.status = IncidenStatusEnum[status];

        await persis.removeByAssociations([userAssoc, roomAssoc]);
        await persis.createWithAssociations(record, [userAssoc, roomAssoc]);

        this.app.getLogger().log(record);

        return ApiResponseUtilities.getAutoClosingHtml();
    }
}
