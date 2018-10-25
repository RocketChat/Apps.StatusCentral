import { ServiceStatusEnum } from '../enums/serviceStatus';
import { RcStatusApp } from '../RcStatusApp';
import { RoomUtility } from '../utils/rooms';
import { UserUtility } from '../utils/users';
import { StepEnum } from './../enums/step';
import { IContainer } from './../models/container';

import { HttpStatusCode, IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IApiRequest, IApiResponse } from '@rocket.chat/apps-engine/definition/api';
import { ApiEndpoint } from '@rocket.chat/apps-engine/definition/api/ApiEndpoint';
import { IApiEndpointInfo } from '@rocket.chat/apps-engine/definition/api/IApiEndpointInfo';
import { IMessageAttachment } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';

export class ProcessStepperApi extends ApiEndpoint {
    constructor(app: RcStatusApp) {
        super(app);
        this.path = 'process';
    }

    public async get(request: IApiRequest, endpoint: IApiEndpointInfo, read: IRead, modify: IModify, http: IHttp, persis: IPersistence): Promise<IApiResponse> {
        this.app.getLogger().log(request);

        const userAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, request.query.userId);
        const roomAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, request.query.roomId);
        const existing = await read.getPersistenceReader().readByAssociations([userAssoc, roomAssoc]);

        if (existing.length === 1 && request.query.step) {
            const record = existing[0] as IContainer;

            this.app.getLogger().log(`Going to the step: ${ request.query.step } from ${ record.step }`, record);

            switch (request.query.step) {
                case StepEnum.Status:
                    await this.goToStatusSelection(record, read, modify);
                    break;
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

    private async goToStatusSelection(data: IContainer, read: IRead, modify: IModify): Promise<void> {
        if (!data.data.services || data.data.services.length === 0) {
            return;
        }

        data.step = StepEnum.Status;

        const mb = modify.getCreator().startMessage()
                    .setText('Please select the status for each service.')
                    .setRoom(await RoomUtility.getRoom(read, data.roomId))
                    .setSender(await UserUtility.getRocketCatUser(read))
                    .setUsernameAlias('RC Status');

        const params = `?userId=${ data.userId }&roomId=${ data.roomId }`;
        const siteUrl = await read.getEnvironmentReader().getServerSettings().getValueById('Site_Url') as string;
        data.data.services.forEach((s) => {
            const att: IMessageAttachment = {
                color: '#ffff00',
                title: {
                    value: s.name,
                },
                actions: [],
            };

            Object.values(ServiceStatusEnum).forEach((sta) => {
                if (!att.actions) {
                    return;
                }

                att.actions.push({
                    type: 'button',
                    text: sta,
                    url: `${ siteUrl }api/apps/public/${ this.app.getID() }/status${ params }&service=${ sta }`,
                });
            });

            mb.addAttachment(att);
        });

        const finishAttach: IMessageAttachment = {
            color: '#551a8b',
            actions: [{
                type: 'button',
                text: 'Next Step',
                url: `${ siteUrl }api/apps/public/${ this.app.getID() }/process${ params }&step=${ StepEnum.Review }`,
            }],
        };

        mb.addAttachment(finishAttach);

        this.app.getLogger().log(mb.getMessage());

        await modify.getCreator().finish(mb);

        return;
    }
}
