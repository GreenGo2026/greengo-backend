"""
Background periodic tasks.

Deliberately plain asyncio rather than APScheduler: the app already uses this
idiom for the Mongo keepalive in main.py, it needs no extra dependency, and
APScheduler would bring no benefit here -- without a shared job store it
double-fires under multiple workers exactly as a bare task does.

NOTE: if this app is ever scaled past a single instance, these loops run once
per instance. Anything that must fire exactly once globally needs a lock or a
job store first.
"""
from __future__ import annotations

import asyncio
from typing import Any, Awaitable, Callable

# Task registry: (name, interval_seconds, coroutine factory)
# Kept declarative so adding a job is one line.
_JOBS: list[tuple[str, float, Callable[[], Awaitable[Any]]]] = []


def register_job(name: str, interval_seconds: float, fn: Callable[[], Awaitable[Any]]) -> None:
    """
    Register a periodic job. Idempotent by name -- lifespan can run more than
    once in a process (tests, reload), and re-registering would otherwise
    launch a second copy of every job.
    """
    for i, (existing, _, _) in enumerate(_JOBS):
        if existing == name:
            _JOBS[i] = (name, interval_seconds, fn)
            return
    _JOBS.append((name, interval_seconds, fn))


async def _run_periodic(
    name: str,
    interval_seconds: float,
    fn: Callable[[], Awaitable[Any]],
    *,
    initial_delay: float,
) -> None:
    """
    Run fn every interval_seconds, forever.

    Exceptions are logged and swallowed -- one failed run must not kill the
    loop, or a single transient Mongo blip would silently stop the job for the
    lifetime of the process. CancelledError propagates so shutdown works.
    """
    # Stagger startup so jobs don't all fire at once during a cold boot, and
    # so a crash-looping deploy doesn't hammer the DB on every restart.
    await asyncio.sleep(initial_delay)
    while True:
        try:
            await fn()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            print(f"[SCHEDULER] job '{name}' failed: {type(exc).__name__}: {exc}")
        await asyncio.sleep(interval_seconds)


def start_scheduler() -> list[asyncio.Task[None]]:
    """Launch every registered job. Returns the tasks so lifespan can cancel them."""
    tasks: list[asyncio.Task[None]] = []
    for i, (name, interval, fn) in enumerate(_JOBS):
        # 15s apart, so a cold start doesn't run everything simultaneously.
        task = asyncio.create_task(
            _run_periodic(name, interval, fn, initial_delay=15.0 + i * 15.0),
            name=f"scheduler:{name}",
        )
        tasks.append(task)
        print(f"[SCHEDULER] registered '{name}' every {interval:.0f}s")
    if not tasks:
        print("[SCHEDULER] no jobs registered")
    return tasks


async def stop_scheduler(tasks: list[asyncio.Task[None]]) -> None:
    for task in tasks:
        task.cancel()
    for task in tasks:
        try:
            await task
        except (asyncio.CancelledError, Exception):
            pass
