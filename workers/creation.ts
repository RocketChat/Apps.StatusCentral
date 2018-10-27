import { ServiceStatusEnum } from '../enums/serviceStatus';
import { StepEnum } from '../enums/step';
import { RoomUtility } from '../utils/rooms';
import { IncidenStatusEnum } from './../enums/incidentStatus';
import { IContainer } from './../models/container';
import { RcStatusApp } from './../RcStatusApp';
import { UserUtility } from './../utils/users';

import { IHttp, IModify, IPersistence, IRead } from '@rocket.chat/apps-engine/definition/accessors';
import { IMessageAttachment, MessageActionButtonsAlignment, MessageActionType } from '@rocket.chat/apps-engine/definition/messages';
import { RocketChatAssociationModel, RocketChatAssociationRecord } from '@rocket.chat/apps-engine/definition/metadata';
import { SlashCommandContext } from '@rocket.chat/apps-engine/definition/slashcommands';

export class IncidentCreationWorker {
    private app: RcStatusApp;

    constructor(app: RcStatusApp) {
        this.app = app;
    }

    public async start(context: SlashCommandContext, read: IRead, modify: IModify, persis: IPersistence): Promise<void> {
        const userAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.USER, context.getSender().id);
        const roomAssoc = new RocketChatAssociationRecord(RocketChatAssociationModel.ROOM, context.getRoom().id);
        const existing = await read.getPersistenceReader().readByAssociations([userAssoc, roomAssoc]);

        if (existing.length > 0) {
            const msg = modify.getCreator().startMessage()
                .setUsernameAlias('RC Status')
                .setRoom(context.getRoom())
                .setText('You are already creating an incident. Please abort if you wish to start over.');

            await modify.getNotifier().notifyUser(context.getSender(), msg.getMessage());
            return;
        }

        const title = context.getArguments().slice(1, context.getArguments().length).join(' ');
        this.app.getLogger().log(`Starting incident creation of: ${ title }`);

        const container: IContainer = {
            step: StepEnum.Creation,
            userId: userAssoc.getID(),
            roomId: roomAssoc.getID(),
            data: {
                time: new Date(),
                title,
            },
        };

        await persis.createWithAssociations(container, [userAssoc, roomAssoc]);

        const mb = modify.getCreator().startMessage()
                    .setText('Please select the status of the incident:')
                    .setRoom(context.getRoom())
                    .setSender(await UserUtility.getRocketCatUser(read))
                    .setUsernameAlias('RC Status');

        const attach: IMessageAttachment = {
            color: '#00aaff',
            timestamp: new Date(),
            title: {
                value: 'Incident Status',
            },
            collapsed: true,
            actionButtonsAlignment: MessageActionButtonsAlignment.HORIZONTAL,
            actions: [],
        };

        const params = `?userId=${ container.userId }&roomId=${ container.roomId }`;
        const siteUrl = await read.getEnvironmentReader().getServerSettings().getValueById('Site_Url') as string;
        Object.values(IncidenStatusEnum).forEach((s) => {
            if (!attach.actions) {
                return;
            }

            attach.actions.push({
                type: MessageActionType.BUTTON,
                text: s,
                url: `${ siteUrl }api/apps/public/${ this.app.getID() }/incident${ params }&status=${ s }`,
            });
        });

        mb.addAttachment(attach);

        const finishAttach: IMessageAttachment = {
            color: '#551a8b',
            actions: [{
                type: MessageActionType.BUTTON,
                text: 'Next Step',
                url: `${ siteUrl }api/apps/public/${ this.app.getID() }/process${ params }&step=${ StepEnum.Services }`,
            }],
        };

        mb.addAttachment(finishAttach);

        this.app.getLogger().log(mb.getMessage());

        await modify.getCreator().finish(mb);

        return;
    }

    public async sendServiceSelection(data: IContainer, read: IRead, modify: IModify, http: IHttp): Promise<void> {
        if (data.step !== StepEnum.Creation) {
            // TODO: Maybe display an error showing except step but show current step?
            return;
        }

        if (!data.data.status) {
            // TODO: Maybe display an error?
            return;
        }

        const services = await this.app.getHttpWorker().retrieveServices(read, http);

        const mb = modify.getCreator().startMessage()
                    .setText('Please select the services which are affected.')
                    .setRoom(await RoomUtility.getRoom(read, data.roomId))
                    .setSender(await UserUtility.getRocketCatUser(read))
                    .setUsernameAlias('RC Status');

        // Attachment for the services
        const attach: IMessageAttachment = {
            color: '#fe117a',
            timestamp: new Date(),
            title: {
                value: 'Service Selection',
            },
            collapsed: true,
            actionButtonsAlignment: MessageActionButtonsAlignment.HORIZONTAL,
            actions: [],
        };

        const params = `?userId=${ data.userId }&roomId=${ data.roomId }`;
        const siteUrl = await read.getEnvironmentReader().getServerSettings().getValueById('Site_Url') as string;
        services.forEach((s) => {
            if (!attach || !attach.actions) {
                return;
            }

            attach.actions.push({
                type: MessageActionType.BUTTON,
                text: s.name,
                url: `${ siteUrl }api/apps/public/${ this.app.getID() }/service${ params }&service=${ s.name }`,
            });
        });

        mb.addAttachment(attach);

        // Attachment for the finish button
        const finishAttach: IMessageAttachment = {
            color: '#551a8b',
            actions: [{
                type: MessageActionType.BUTTON,
                text: 'Next Step',
                url: `${ siteUrl }api/apps/public/${ this.app.getID() }/process${ params }&step=${ StepEnum.Status }`,
            }],
        };

        mb.addAttachment(finishAttach);

        this.app.getLogger().log(mb.getMessage());

        await modify.getCreator().finish(mb);

        return;
    }

    public async sendStatusSelection(data: IContainer, read: IRead, modify: IModify): Promise<void> {
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
                timestamp: new Date(),
                title: {
                    value: s.name,
                },
                collapsed: true,
                actionButtonsAlignment: MessageActionButtonsAlignment.HORIZONTAL,
                actions: [],
            };

            Object.values(ServiceStatusEnum).forEach((sta) => {
                if (!att.actions) {
                    return;
                }

                att.actions.push({
                    type: MessageActionType.BUTTON,
                    text: sta,
                    url: `${ siteUrl }api/apps/public/${ this.app.getID() }/status${ params }&service=${ s.name }&status=${ sta }`,
                });
            });

            mb.addAttachment(att);
        });

        const finishAttach: IMessageAttachment = {
            color: '#551a8b',
            actions: [{
                type: MessageActionType.BUTTON,
                text: 'Next Step',
                url: `${ siteUrl }api/apps/public/${ this.app.getID() }/process${ params }&step=${ StepEnum.Review }`,
            }],
        };

        mb.addAttachment(finishAttach);

        this.app.getLogger().log(mb.getMessage());

        await modify.getCreator().finish(mb);
    }

    public async sendDataForReview(): Promise<void> {
        return;
    }
}
