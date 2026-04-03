from typing import TypedDict, Annotated, Optional
from langgraph.graph.message import add_messages


class QamarethState(TypedDict):
    messages:         Annotated[list, add_messages]
    active_agent:     str
    task_type:        str
    work_product:     str
    mechanical_flags: list[str]
    lore_flags:       list[str]
    audit_flags:      list[str]
    validated:        bool
    iteration_count:  int
    error:            Optional[str]
