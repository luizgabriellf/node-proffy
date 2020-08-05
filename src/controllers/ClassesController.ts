
import { Request, Response } from 'express';

import db from '../database/connection';
import convertHourtoMinutes from '../utils/convertHourToMinutes';

interface ScheduleItem {
    week_day: number,
    from: string,
    to: string
}

export default class ClassesController {
    async index(request: Request, response: Response) {
        const filters = request.query;
        if (!filters.week_day || !filters.subject || !filters.time) {
            const classes = await db('classes')
                .join('users', 'classes.user_id', '=', 'users.id')
                .select(['classes.*', 'users.*']);
            return response.json(classes);
        }

        const timeInMinutes = convertHourtoMinutes(filters.time as string);

        const classes = await db('classes')
            .whereExists(function () {
                this.select('class_schedule.*')
                    .from('class_schedule')
                    .whereRaw('`class_schedule`.`class_id` = `classes`.`id`')
                    .whereRaw('`class_schedule`.`week_day` = ??', [Number(filters.week_day)])
                    .whereRaw('`class_schedule`.`from` <= ??', [timeInMinutes])
                    .whereRaw('`class_schedule`.`to` > ??', [timeInMinutes])
            })
            .where('classes.subject', '=', filters.subject as string)
            .join('users', 'classes.user_id', '=', 'users.id')
            .select(['classes.*', 'users.*'])

        return response.json(classes);
    }

    async create(request: Request, response: Response) {
        const {
            name,
            avatar,
            whatsapp,
            bio,
            subject,
            cost,
            schedule
        } = request.body;

        const trx = await db.transaction();

        try {
            const inssertedUsersIds = await trx('users').insert({
                name,
                avatar,
                whatsapp,
                bio
            });

            const user_id = inssertedUsersIds[0];

            const inssertedClassesIds = await trx('classes').insert({
                subject,
                cost,
                user_id
            });

            const class_id = inssertedClassesIds[0];

            const classSchedule = schedule.map((scheduleItem: ScheduleItem) => {
                return {
                    class_id,
                    week_day: scheduleItem.week_day,
                    from: convertHourtoMinutes(scheduleItem.from),
                    to: convertHourtoMinutes(scheduleItem.to),
                }
            });

            await trx('class_schedule').insert(classSchedule);

            await trx.commit();
            return response.status(201).send();
        } catch (err) {
            await trx.rollback();
            return response.status(400).json(err);
        }
    };


}