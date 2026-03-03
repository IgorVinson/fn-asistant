# User Stories

## General
1. I apply on all jobs with source rate (get all job availible mode) and check only schedule - GET_ALL_JOBS
2. Only Granite - only granite jobs, but should check schedule and is_counter_rates.
3. For big jobs > 8h we do not do counter_rates

## Payment
3. If wo with hourly rate we counter hourly (if is_counter_rates = true) or with source rate (if is_counter_rates = false)
4. If wo with fixed rate we counter with source rate, but if is_counter_rates = true we should count base hourly rate * labor hours
5. Travel expences always check

* Is counter rates - if true we reapply basic on base hourly rate, that diff for each platform
* Base hourly rate should be different for fieldnation and workmarket


## Schedule
* Never counter date earlier than in wo

* We need to think how to schedule jobs in case of multiple jobs in same day, usually I have 9-13 or 10-14 first slot and 14-18 or 15-19 second slot but if job 2h i can have 3 jobs in a day. So we need to find the best way to schedule jobs in case of multiple jobs in same day. Now it looks at conflict but its not good enough. Because some time job can go fast and then i have free time. So schedule should be by time slots, not by jobs. And then we just counter time that i have free basic on slots

## Stop word list
* add stop word list for fieldnation and workmarket, for example i don`t wont do starlink installation for now i want to skip all jobs with starlink installation, or with ledder over 8ft required