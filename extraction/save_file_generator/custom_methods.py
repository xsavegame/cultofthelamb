from .finalized_notification_methods import render_finalized_notification_methods
from .ranchable_animal_methods import render_ranchable_animal_methods
from .story_objective_data_methods import render_story_objective_data_methods


CUSTOM_METHOD_RENDERERS = (
    render_finalized_notification_methods,
    render_story_objective_data_methods,
    render_ranchable_animal_methods,
)


def render_custom_class_methods(class_name):
    lines = []
    for renderer in CUSTOM_METHOD_RENDERERS:
        lines.extend(renderer(class_name))
    return lines
