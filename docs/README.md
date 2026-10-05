# Documentation

The documentation is split into four kinds of document, following
[Diátaxis](https://diataxis.fr). Each kind answers a different question, and mixing
them is what makes documentation hard to use — so they are kept in separate
directories rather than in one long file.

| Kind | Question it answers | Read it when |
| --- | --- | --- |
| [Tutorial](tutorials/) | *Show me how to use this, step by step.* | You have never run it before. |
| [How-to guide](how-to/) | *How do I do this specific thing?* | You know the system and have a task. |
| [Reference](reference/) | *What exactly does this accept and return?* | You need exact details while working. |
| [Explanation](explanation/) | *Why is it built this way?* | You want to understand the design. |

## Start here

- **New to the project?** Read the root [README](../README.md), then the tutorial
  [Your first campaign](tutorials/first-campaign.md). It takes about ten minutes.
- **Need to do a task?** Jump to the [how-to guides](how-to/).
- **Integrating against the API?** Use the [generated reference](reference/api.md),
  which is rendered from the same schemas the server validates with.
- **Reviewing a change?** Read the [explanation](explanation/) for the boundaries a
  change must respect, and the [versioning policy](explanation/api-versioning.md)
  before altering any request or response shape.
