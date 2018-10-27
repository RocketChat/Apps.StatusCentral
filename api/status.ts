
import { IContainer } from '../models/container';
import { RcStatusApp } from '../RcStatusApp';
import { ApiResponseUtilities } from '../utils/apiResponses';

import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApiRequest, IApiResponse } from '@rocket.chat/apps-engine/definition/api';
import { ApiEndpoint } from '@rocket.chat/apps-engine/definition/api/ApiEndpoint';
import { IApiEndpointInfo } from '@rocket.chat/apps-engine/definition/api/IApiEndpointInfo';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { ServiceStatusEnum } from '../enums/serviceStatus';
import { EnumUtilities } from '../utils/enums';

export class StatusSelectionApi extends ApiEndpoint {
    constructor(app: RcStatusApp) {
        super(app);
        this.path = 'status';
    }

    public async get(request: IApiRequest, endpoint: IApiEndpointInfo, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<IApiResponse> {
        const userAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, request.query.userId);
        const roomAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, request.query.roomId);
        const existing = await read.getPersistenceReader().readByAssociations([userAssoc, roomAssoc]);

        if (existing.length < 1 && !request.query.service && !request.query.status) {
            return ApiResponseUtilities.getAutoClosingHtml();
        }

        const record = existing[0] as IContainer;

        if (!record.data.services || record.data.services.length === 0) {
            return ApiResponseUtilities.getAutoClosingHtml();
        }

        const { service, status } = request.query;
        const stat = EnumUtilities.getServiceStatusFromValue(status);
        this.app.getLogger().log(`Setting the status of ${ service } to ${ stat }`);

        record.data.services.forEach((s) => {
            if (s.name !== service) {
                return;
            }

            s.status = stat;
        });

        await persis.removeByAssociations([userAssoc, roomAssoc]);
        await persis.createWithAssociations(record, [userAssoc, roomAssoc]);

        this.app.getLogger().log(record);

        return ApiResponseUtilities.getAutoClosingHtml();
    }
}
